import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler, getMcpAuthContext } from "agents/mcp/server";
import {
  createGtmMcpServer,
  createStaticTokenAuth,
} from "google-tag-manager-mcp-core";
import { SERVER_INFO } from "./constants/serverInfo";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { removeMCPServerData } from "./tools/removeMCPServerData";

/**
 * `OAuthProvider` decrypts the grant onto `ctx.props` before it calls any
 * `apiHandler`, and `createMcpHandler`'s callable form puts that same object
 * into an `AsyncLocalStorage` store for the whole request lifecycle - so this
 * is the stateless equivalent of `McpAgent`'s `this.props`.
 */
function requireProps(): McpAgentPropsModel {
  const props = getMcpAuthContext()?.props as McpAgentPropsModel | undefined;

  if (!props?.accessToken) {
    throw new Error(
      "Missing Google credentials on this session. Please re-authenticate.",
    );
  }

  return props;
}

/**
 * The SDK v2 `/mcp` route. `createMcpHandler` (the Agents wrapper around the v2
 * SDK's own `createMcpHandler`) owns the era decision: modern 2026-07-28
 * traffic - which opens with a `server/discover` probe carrying an
 * `io.modelcontextprotocol/*` `_meta` envelope - is served on the modern path,
 * and claim-less 2025-era `initialize` traffic falls back to stateless legacy
 * serving off the same factory. Building a v2 `McpServer` by hand and wiring a
 * transport would serve the 2025 era only, exactly like the CLI's `serveStdio`
 * finding.
 *
 * Built per request so the tool factory can close over `env`; `OAuthProvider`
 * itself is already reconstructed per request today.
 */
export function createMcpApiHandler(
  env: Env,
): Required<Pick<ExportedHandler<Env>, "fetch">> {
  const handler = createMcpHandler(
    () => {
      const props = requireProps();

      return createGtmMcpServer({
        // Read at call time: a client that refreshes its grant mid-stream gets
        // fresh props on the next request, and each request builds its own
        // server instance anyway.
        auth: createStaticTokenAuth(() => ({
          accessToken: props.accessToken,
          expiresAt: props.expiresAt,
        })),
        serverInfo: { ...SERVER_INFO },
        extraTools: [
          (server) =>
            removeMCPServerData(server, {
              props,
              // Injected by OAuthProvider before it calls this API handler.
              oauth: (env as Env & { OAUTH_PROVIDER: OAuthHelpers })
                .OAUTH_PROVIDER,
            }),
        ],
      });
    },
    {
      route: "/mcp",
      // The legacy `McpAgent.serve("/mcp")` handler never allowlisted Origin,
      // and this endpoint is a public HTTPS server gated by an OAuth bearer
      // token rather than a localhost server that DNS rebinding could reach.
      // Leaving the default on would 403 every browser-based client.
      allowedOriginHostnames: "*",
    },
  );

  // `OAuthProvider.validateHandler` only accepts `typeof handler === "object"`
  // with a `fetch` method, so the callable that `createMcpHandler` returns has
  // to be wrapped - and it must be the callable `(request, env, ctx)` form, not
  // its `.fetch(request, requestOptions)` property, which never sees `ctx`
  // (and therefore never sees `ctx.props`).
  return {
    // `env` here is the same per-request value closed over above (see the doc
    // comment); the handler's own `env` parameter is unused downstream (its
    // callable form ignores it), so it's prefixed to signal that.
    fetch: (request: Request, _workerEnv: Env, ctx: ExecutionContext) =>
      handler(request, env, ctx),
  };
}
