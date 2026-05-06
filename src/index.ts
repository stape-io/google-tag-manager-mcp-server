import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { tools } from "./tools";
import {
  apisHandler,
  getPackageVersion,
  handleTokenExchangeCallback,
} from "./utils";

export class GoogleTagManagerMCPServer extends McpAgent<
  Env,
  null,
  McpAgentPropsModel
> {
  server = new McpServer({
    name: "google-tag-manager-mcp-server",
    version: getPackageVersion(),
    protocolVersion: "1.0",
    vendor: "stape-io",
    homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
  });

  async init() {
    console.log("[MCP] init() called");

    tools.forEach((register) => {
      // @ts-ignore
      register(this.server, { props: this.props, env: this.env });
    });
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
