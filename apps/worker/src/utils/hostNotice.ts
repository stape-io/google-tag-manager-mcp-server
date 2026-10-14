import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";

/**
 * Clients still on `gtm-mcp.stape.ai` get a notice in the `initialize`
 * instructions and at the end of every tool result. From the cutover, tools
 * there stop running and return only the "moved" message. The protocol itself
 * (and OAuth) keeps working on purpose: claude.ai and Claude Desktop
 * connectors replace any protocol-level error with a generic "couldn't reach
 * the server", so a tool result is the only place every client shows our text.
 * The `.io` deployment has its own OAuth store, so moving means a new Google
 * sign-in.
 */
const OLD_HOST = "gtm-mcp.stape.ai";
const NEW_URL = "https://gtm-mcp.stape.io/mcp";
export const CUTOVER_AT = Date.UTC(2026, 11, 1);

export const HOST_NOTICE = `Notice from Stape: ${OLD_HOST} stops working on December 1, 2026 at 00:00 UTC. Change this MCP server's URL in your client config to ${NEW_URL}, then sign in with Google again when prompted.`;

export const MOVED_NOTICE = `Notice from Stape: ${OLD_HOST} was shut down on December 1, 2026 at 00:00 UTC, so this tool no longer runs here. Change this MCP server's URL in your client config to ${NEW_URL}, then sign in with Google again when prompted.`;

const isPastCutover = (): boolean => Date.now() >= CUTOVER_AT;

/** Read when a server is built, so `/sse` keeps what it had at connect time. */
export const hostNoticeInstructions = (): string =>
  isPastCutover()
    ? `Tell the user this before anything else: ${MOVED_NOTICE}`
    : `Tell the user this once per conversation: ${HOST_NOTICE}`;

export const isOldHost = (request: Request): boolean =>
  new URL(request.url).hostname === OLD_HOST;

/**
 * Wraps `server` so every tool registered through it appends the notice to its
 * result, or, from the cutover, returns only the "moved" message. The date is
 * checked per call, so a session open across the cutover switches by itself.
 * Not `isError`: whether claude.ai hides error results behind a generic banner
 * is unverified, and the text has to reach the model. Tools only ever call
 * `registerTool`, so the rest of the server is reached through the prototype.
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
        if (isPastCutover()) {
          return { content: [{ type: "text", text: MOVED_NOTICE }] };
        }

        const result = await handler(...args);

        return {
          ...result,
          content: [...result.content, { type: "text", text: HOST_NOTICE }],
        };
      }),
  });
};
