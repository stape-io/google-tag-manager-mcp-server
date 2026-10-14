import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";

/**
 * `gtm-mcp.stape.ai` keeps working until the cutover, then answers every
 * request with a "moved" error. Until then, clients on it get a notice in the
 * `initialize` instructions and at the end of every tool result. The `.io`
 * deployment has its own OAuth store, so moving means a new Google sign-in.
 */
const OLD_HOST = "gtm-mcp.stape.ai";
const NEW_URL = "https://gtm-mcp.stape.io/mcp";
export const CUTOVER_AT = Date.UTC(2026, 11, 1);

export const HOST_NOTICE = `Notice from Stape: ${OLD_HOST} stops working on December 1, 2026. Change this MCP server's URL in your client config to ${NEW_URL}, then sign in with Google again when prompted.`;

export const HOST_NOTICE_INSTRUCTIONS = `Tell the user this once per conversation: ${HOST_NOTICE}`;

export const isOldHost = (request: Request): boolean =>
  new URL(request.url).hostname === OLD_HOST;

export const isPastCutover = (request: Request): boolean =>
  isOldHost(request) && Date.now() >= CUTOVER_AT;

/**
 * Wraps `server` so every tool registered through it appends the notice to its
 * result. Tools only ever call `registerTool`, so the rest of the server is
 * reached through the prototype unchanged.
 */
export const withHostNotice = (server: McpServer): McpServer => {
  const registerTool = server.registerTool.bind(server) as (
    ...args: unknown[]
  ) => unknown;

  return Object.assign(Object.create(server), {
    registerTool: (
      name: string,
      config: unknown,
      handler: (...args: unknown[]) => Promise<CallToolResult>,
    ) =>
      registerTool(name, config, async (...args: unknown[]) => {
        const result = await handler(...args);

        return {
          ...result,
          content: [...result.content, { type: "text", text: HOST_NOTICE }],
        };
      }),
  });
};

/**
 * The JSON-RPC error every request to the old host gets after the cutover.
 * POSTs get it with a 200, so SDK clients (Claude Code, mcp-remote) show the
 * message itself; on a 4xx they show the raw body instead. A GET (stream or
 * `/sse` connect) gets a 410, since a 200 would be read as an event stream. The
 * Origin is echoed because this skips OAuthProvider, like the `/mcp` 405.
 */
export const movedResponse = async (request: Request): Promise<Response> => {
  let id: unknown = null;

  try {
    id = ((await request.clone().json()) as { id?: unknown })?.id ?? null;
  } catch {
    // No body (GET) or not JSON: answer with a null id.
  }

  const headers = new Headers();
  const origin = request.headers.get("Origin");

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return Response.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: `${OLD_HOST} was shut down on December 1, 2026. Moved to ${NEW_URL}: change the server URL in your MCP client config and sign in with Google again.`,
      },
    },
    { status: request.method === "POST" ? 200 : 410, headers },
  );
};
