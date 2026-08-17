import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import {
  createStaticTokenAuth,
  registerGtmTools,
  setUnauthorizedHint,
} from "google-tag-manager-mcp-core";
import { TAG_MANAGER_REMOVE_MCP_SERVER_DATA } from "./constants/tools";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { removeMCPServerData } from "./tools/removeMCPServerData";
import { apisHandler, handleTokenExchangeCallback } from "./utils";
import { PACKAGE_VERSION } from "./version";

setUnauthorizedHint(
  `It seems that your token has been expired, please use ${TAG_MANAGER_REMOVE_MCP_SERVER_DATA} tool to clear your session in the MCP client`,
);

export class GoogleTagManagerMCPServer extends McpAgent<
  Env,
  null,
  McpAgentPropsModel
> {
  server = new McpServer({
    name: "google-tag-manager-mcp-server",
    title: "Google Tag Manager",
    version: PACKAGE_VERSION,
    websiteUrl: "https://github.com/stape-io/google-tag-manager-mcp-server",
  });

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

    registerGtmTools(this.server, { auth });
    removeMCPServerData(this.server, { props, env: this.env });
  }
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

    if (isMcp || isLegacySse) {
      console.log("[MCP_STREAM] Connection opening", logBase);

      request.signal.addEventListener("abort", () => {
        console.log("[MCP_STREAM] Connection aborted", {
          ...logBase,
          durationMs: Date.now() - startedAt,
        });
      });
    }

    const provider = new OAuthProvider({
      apiRoute: ["/sse", "/mcp"],
      apiHandlers: {
        "/sse": GoogleTagManagerMCPServer.serveSSE("/sse"),
        "/mcp": GoogleTagManagerMCPServer.serve("/mcp"),
      },
      // @ts-ignore
      defaultHandler: apisHandler,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      tokenExchangeCallback: async (options) => {
        return handleTokenExchangeCallback(options, env);
      },
    });

    try {
      const response = await provider.fetch(request, env, ctx);

      const durationMs = Date.now() - startedAt;

      console.log("[HTTP] Response", {
        requestId,
        durationMs,
        status: response.status,
        path: url.pathname,
      });

      if (response.status >= 400) {
        console.error("[HTTP] Error response", {
          requestId,
          status: response.status,
          method: request.method,
          path: url.pathname,
        });
      }

      return response;
    } catch (err) {
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
