import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { TAG_MANAGER_REMOVE_MCP_SERVER_DATA } from "../constants/tools";

/**
 * Clients still on `gtm-mcp.stape.ai` get a notice in the `initialize`
 * instructions and at the end of tool results (see `withHostNotice` for the
 * ones it can't reach). From the cutover, tools there stop running and return
 * only the "moved" message, except sign-out. The protocol itself, and OAuth
 * for existing grants, keep working on purpose: claude.ai and Claude Desktop
 * connectors replace any protocol-level error with a generic "couldn't reach
 * the server", so a tool result is the only place every client shows our text.
 * New sign-ins stop at the cutover: the user is in the browser by then, so
 * `/authorize` shows the shutdown notice as a page instead of asking Google
 * for access this host would never use (see apisHandler.ts). The `.io`
 * deployment has its own OAuth store, so moving means a new Google sign-in.
 *
 * Only the `.ai` deployment turns this on: the `SHOW_HOST_NOTICE` var is
 * "true" in the default environment of wrangler.jsonc and "false" in the
 * others.
 */
export const OLD_HOST = "gtm-mcp.stape.ai";
const NEW_HOST = "gtm-mcp.stape.io";
export const CUTOVER_AT = Date.UTC(2026, 11, 1);
// Keep in step with CUTOVER_AT.
const CUTOVER_TEXT = "December 1, 2026 at 00:00 UTC";

const HOW_TO_MOVE = `In this MCP server's URL in your client config, replace ${OLD_HOST} with ${NEW_HOST} and keep the path: https://${OLD_HOST}/mcp becomes https://${NEW_HOST}/mcp, and https://${OLD_HOST}/sse becomes https://${NEW_HOST}/sse. Then sign in with Google again when prompted. If your organization manages this connector, ask an admin to change its URL.`;

export const HOST_NOTICE = `Notice from Stape: ${OLD_HOST} stops working on ${CUTOVER_TEXT}. ${HOW_TO_MOVE}`;

// Appended to every tool result, so kept to one line. The full HOW_TO_MOVE
// stays in the instructions, the approval dialog and the shutdown page.
export const TOOL_NOTICE = `Notice from Stape: ${OLD_HOST} stops working on ${CUTOVER_TEXT}. In this server's URL, replace ${OLD_HOST} with ${NEW_HOST} (same path), then sign in with Google again (org-managed connector: ask an admin).`;

/** For server-level text and for sign-out, which still runs. */
export const SHUTDOWN_NOTICE = `Notice from Stape: ${OLD_HOST} was shut down on ${CUTOVER_TEXT}. ${HOW_TO_MOVE}`;

export const MOVED_NOTICE = `Notice from Stape: ${OLD_HOST} was shut down on ${CUTOVER_TEXT}, so this tool no longer runs here. ${HOW_TO_MOVE}`;

export const isPastCutover = (): boolean => Date.now() >= CUTOVER_AT;

export const showsHostNotice = (env: Pick<Env, "SHOW_HOST_NOTICE">): boolean =>
  env.SHOW_HOST_NOTICE === "true";

/** The gtm-mcp.stape.ai deployment, from the cutover on. */
export const isShutDown = (env: Pick<Env, "SHOW_HOST_NOTICE">): boolean =>
  showsHostNotice(env) && isPastCutover();

/**
 * Read when a server is built. An `/sse` server keeps it until its Durable
 * Object restarts and `init()` runs again.
 */
export const hostNoticeInstructions = (): string =>
  isPastCutover()
    ? `Tell the user this before anything else: ${SHUTDOWN_NOTICE}`
    : `Tell the user this once per conversation: ${HOST_NOTICE}`;

/**
 * Wraps `server` so every tool registered through it appends the notice to its
 * result, or, from the cutover, returns only the "moved" message without
 * running. Sign-out keeps running after the cutover, so users can still revoke
 * what this deployment holds; it appends the shutdown notice to its own result
 * (it words that result for the old host itself, see removeMCPServerData). The
 * date is checked per call, so a session open across the cutover switches by
 * itself. Not `isError`: whether
 * claude.ai hides error results behind a generic banner is unverified, and the
 * text has to reach the model.
 *
 * The SDK validates arguments before it calls a handler, so a call rejected by
 * `inputSchema` never gets here. Before the cutover such errors go out without
 * the notice. A server built after the cutover registers its tools without
 * `inputSchema` (and `outputSchema`, which the moved notice wouldn't match), so
 * every call reaches the handler and gets the moved notice. `/mcp` builds a
 * server per request; an `/sse` server built before the cutover keeps its
 * schemas until its Durable Object restarts and `init()` runs again.
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
    // Read once: a handler registered without its schema must never run.
    const stripped = isPastCutover() && !keepsRunning;

    return registerTool(
      name,
      stripped
        ? { ...config, inputSchema: undefined, outputSchema: undefined }
        : config,
      async (...args: unknown[]) => {
        const moved = isPastCutover();

        if (stripped || (moved && !keepsRunning)) {
          return { content: [{ type: "text", text: MOVED_NOTICE }] };
        }

        const result = await handler(...args);

        return {
          ...result,
          content: [
            ...(result.content ?? []),
            { type: "text", text: moved ? SHUTDOWN_NOTICE : TOOL_NOTICE },
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
