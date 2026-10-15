import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { TAG_MANAGER_REMOVE_MCP_SERVER_DATA } from "../constants/tools";

/**
 * Clients still on `gtm-mcp.stape.ai` get a notice in the `initialize`
 * instructions and at the end of every tool result. From the cutover, tools
 * there stop running and return only the "moved" message. The protocol itself
 * (and OAuth) keeps working on purpose: claude.ai and Claude Desktop
 * connectors replace any protocol-level error with a generic "couldn't reach
 * the server", so a tool result is the only place every client shows our text.
 * The `.io` deployment has its own OAuth store, so moving means a new Google
 * sign-in.
 *
 * Only the `.ai` deployment turns this on: the `SHOW_HOST_NOTICE` var is
 * "true" in the default environment of wrangler.jsonc and "false" in the
 * others.
 */
const OLD_HOST = "gtm-mcp.stape.ai";
const NEW_HOST = "gtm-mcp.stape.io";
export const CUTOVER_AT = Date.UTC(2026, 11, 1);

const HOW_TO_MOVE = `In this MCP server's URL in your client config, replace ${OLD_HOST} with ${NEW_HOST} (for example https://${NEW_HOST}/mcp), keeping the same path. Then sign in with Google again when prompted.`;

export const HOST_NOTICE = `Notice from Stape: ${OLD_HOST} stops working on December 1, 2026 at 00:00 UTC. ${HOW_TO_MOVE}`;

export const MOVED_NOTICE = `Notice from Stape: ${OLD_HOST} was shut down on December 1, 2026 at 00:00 UTC, so this tool no longer runs here. ${HOW_TO_MOVE}`;

export const isPastCutover = (): boolean => Date.now() >= CUTOVER_AT;

export const showsHostNotice = (env: Pick<Env, "SHOW_HOST_NOTICE">): boolean =>
  env.SHOW_HOST_NOTICE === "true";

/** Read when a server is built, so `/sse` keeps what it had at connect time. */
export const hostNoticeInstructions = (): string =>
  isPastCutover()
    ? `Tell the user this before anything else: ${MOVED_NOTICE}`
    : `Tell the user this once per conversation: ${HOST_NOTICE}`;

/**
 * Wraps `server` so every tool registered through it appends the notice to its
 * result, or, from the cutover, returns only the "moved" message without
 * running. Sign-out keeps running after the cutover, so users can still revoke
 * what this deployment holds. The date is checked per call, so a session open
 * across the cutover switches by itself. Not `isError`: whether claude.ai hides
 * error results behind a generic banner is unverified, and the text has to
 * reach the model.
 *
 * The SDK validates arguments before it calls a handler, so a call rejected by
 * `inputSchema` never gets here. Before the cutover such errors go out without
 * the notice. A server built after the cutover registers its tools without
 * `inputSchema`, so every call reaches the handler and gets the moved notice;
 * `/mcp` builds one per request, while an `/sse` session opened before the
 * cutover keeps its schemas.
 */
export const withHostNotice = (server: McpServer): McpServer => {
  const registerTool = server.registerTool.bind(server) as (
    ...args: unknown[]
  ) => unknown;

  const wrapped = (
    name: string,
    config: object,
    handler: (...args: unknown[]) => Promise<CallToolResult>,
  ): unknown => {
    const keepsRunning = name === TAG_MANAGER_REMOVE_MCP_SERVER_DATA;

    return registerTool(
      name,
      isPastCutover() && !keepsRunning
        ? { ...config, inputSchema: undefined }
        : config,
      async (...args: unknown[]) => {
        const moved = isPastCutover();

        if (moved && !keepsRunning) {
          return { content: [{ type: "text", text: MOVED_NOTICE }] };
        }

        const result = await handler(...args);

        return {
          ...result,
          content: [
            ...(result.content ?? []),
            { type: "text", text: moved ? MOVED_NOTICE : HOST_NOTICE },
          ],
        };
      },
    );
  };

  // A Proxy, not a prototype child: anything else called through it still
  // writes its state onto `server` itself.
  return new Proxy(server, {
    get: (target, prop, receiver) =>
      prop === "registerTool" ? wrapped : Reflect.get(target, prop, receiver),
  });
};
