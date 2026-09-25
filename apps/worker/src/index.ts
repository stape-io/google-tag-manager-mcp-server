import {
  getOAuthApi,
  OAuthProvider,
  type OAuthProviderOptions,
} from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer as McpServerV2 } from "@modelcontextprotocol/server";
import { McpAgent } from "agents/mcp";
import {
  createStaticTokenAuth,
  registerGtmTools,
  setUnauthorizedHint,
} from "google-tag-manager-mcp-core";
import { SERVER_INFO } from "./constants/serverInfo";
import { UNAUTHORIZED_HINT } from "./constants/tools";
import { createMcpApiHandler } from "./mcpHandler";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { removeMCPServerData } from "./tools/removeMCPServerData";
import {
  apisHandler,
  handleTokenExchangeCallback,
  upstreamReauthErrorResponse,
  withSseKeepalive,
} from "./utils";

setUnauthorizedHint(UNAUTHORIZED_HINT);

export class GoogleTagManagerMCPServer extends McpAgent<
  Env,
  null,
  McpAgentPropsModel
> {
  server = new McpServer({ ...SERVER_INFO });

  async init() {
    console.log("[MCP] init() called");

    const props = this.props;

    if (!props?.accessToken) {
      throw new Error(
        "Missing Google credentials on this session. Please re-authenticate.",
      );
    }

    // Read at call time: init() runs once per Durable Object start, but the
    // framework replaces this.props whenever the client refreshes its grant.
    const auth = createStaticTokenAuth(() => ({
      accessToken: this.props?.accessToken,
      expiresAt: this.props?.expiresAt,
    }));

    // Type-only bridge, no runtime change: McpAgent is feature-frozen on SDK
    // v1, so `this.server` is a v1 `McpServer`, while core and
    // removeMCPServerData are now typed against v2's. The two classes are
    // nominally unrelated but structurally compatible for what gets called
    // here - every registration is `registerTool(name, { description,
    // inputSchema }, cb)`, and v1's `registerTool` accepts an `AnySchema`
    // inputSchema (@modelcontextprotocol/sdk/server/zod-compat). Proven by
    // legacySseRegistration.test.ts, which registers the real tool set on a
    // real v1 `McpServer` and lists it back over a v1 client.
    const legacyServer = this.server as unknown as McpServerV2;

    registerGtmTools(legacyServer, { auth });
    // The Durable Object's env never passes through OAuthProvider, so build
    // the helpers from the same options instead of relying on injection.
    removeMCPServerData(legacyServer, {
      props,
      oauth: getOAuthApi(providerOptions(this.env), this.env),
    });
  }
}

function providerOptions(env: Env): OAuthProviderOptions {
  return {
    apiRoute: ["/sse", "/mcp"],
    apiHandlers: {
      "/sse": GoogleTagManagerMCPServer.serveSSE("/sse"),
      "/mcp": createMcpApiHandler(env),
    },
    // @ts-ignore
    defaultHandler: apisHandler,
    authorizeEndpoint: "/authorize",
    tokenEndpoint: "/token",
    clientRegistrationEndpoint: "/register",
    tokenExchangeCallback: async (options) => {
      return handleTokenExchangeCallback(options, env);
    },
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const requestId = crypto.randomUUID();

    const logBase = {
      requestId,
      method: request.method,
      path: url.pathname,
      hasAuth: request.headers.has("authorization"),
      sessionId: request.headers.get("mcp-session-id"),
      accept: request.headers.get("accept"),
      userAgent: request.headers.get("user-agent"),
    };

    console.log("[HTTP] Incoming request", logBase);

    const isMcp = url.pathname === "/mcp" && request.method === "GET";
    const isLegacySse = url.pathname === "/sse" && request.method === "GET";

    // Only `/sse` opens a long-lived GET stream now. `/mcp` is served
    // statelessly, which has no session for a standalone GET stream to attach
    // to, so a GET there answers 405 - logging it as a stream opening would
    // mislead anyone debugging that.
    if (isLegacySse) {
      console.log("[MCP_STREAM] Connection opening", logBase);

      request.signal.addEventListener("abort", () => {
        console.log("[MCP_STREAM] Connection aborted", {
          ...logBase,
          durationMs: Date.now() - startedAt,
        });
      });
    }

    const provider = new OAuthProvider(providerOptions(env));

    try {
      const response = await provider.fetch(request, env, ctx);

      const durationMs = Date.now() - startedAt;

      console.log("[HTTP] Response", {
        requestId,
        durationMs,
        status: response.status,
        path: url.pathname,
      });

      // Every client opens with an unauthenticated probe to discover where to
      // authorize, so a 401 here is the protocol working. Logging it as an
      // error buries the failures worth finding.
      const isAuthChallenge =
        response.status === 401 && (isMcp || url.pathname === "/mcp");

      if (response.status >= 400 && !isAuthChallenge) {
        console.error("[HTTP] Error response", {
          requestId,
          status: response.status,
          method: request.method,
          path: url.pathname,
        });
      }

      if (isLegacySse) {
        return withSseKeepalive(response, request.signal);
      }

      return response;
    } catch (err) {
      const reauthResponse = upstreamReauthErrorResponse(err, request);

      if (reauthResponse) {
        console.warn("[HTTP] Upstream re-authentication required", {
          requestId,
          path: url.pathname,
          durationMs: Date.now() - startedAt,
          message: (err as Error).message,
        });

        return reauthResponse;
      }

      console.error("[HTTP] Unhandled exception", {
        requestId,
        path: url.pathname,
        error:
          err instanceof Error
            ? {
                name: err.name,
                message: err.message,
                stack: err.stack,
              }
            : err,
      });

      throw err;
    }
  },
};
