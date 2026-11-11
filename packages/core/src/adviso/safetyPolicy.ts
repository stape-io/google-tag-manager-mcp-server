import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * Adviso build: no destructive or administrative operations.
 *
 * Three layers, on purpose:
 * 1. Schema: blocked actions (and the 'deleted' change status of bulkUpdate)
 *    are removed from each tool's input schema, so the model never sees them.
 * 2. Runtime: every call is checked again before the handler runs, in case a
 *    client sends something that is not in the schema.
 * 3. OAuth: the scopes in constants/scopes.ts cannot publish, delete
 *    containers, or manage users and accounts.
 *
 * The policy wraps `registerTool` through a Proxy (like the worker's
 * `withHostNotice`), so no upstream tool file is modified. `registerGtmTools`
 * passes the cache runtime explicitly, so the proxy's different identity does
 * not split the runtime that tools would otherwise look up by server object.
 */

/** Tools that are not registered at all. */
export const BLOCKED_TOOLS = new Set<string>(["gtm_user_permission"]);

/** Actions blocked on every tool. */
export const BLOCKED_ACTIONS_EVERYWHERE = new Set<string>([
  "publish",
  "remove",
  "delete",
  "undelete",
]);

/** Extra actions blocked on specific tools. */
export const BLOCKED_ACTIONS_BY_TOOL: Record<string, string[]> = {
  gtm_account: ["update"],
};

/** Values of `changeStatus` that are refused (bulkUpdate, resolveConflict). */
export const BLOCKED_CHANGE_STATUS = new Set<string>(["deleted"]);

const NOTICE =
  " Destructive actions are disabled in this Adviso build: ask the user to do them in the GTM UI.";

/**
 * Text appended to every result of a tool, for tools whose upstream content
 * describes actions this build does not allow (the guide's publish step and
 * user permission audit).
 */
export const RESULT_ADDENDA: Record<string, string> = {
  gtm_guide:
    "\n\n---\nAdviso build: publishing, deleting/removing entities and managing users or accounts are not available through this server. Where this guide says to publish, remove or use gtm_user_permission, stop after 'createVersion' and ask the user to review and do that step in the GTM UI.",
};

export function isActionBlocked(toolName: string, action: unknown): boolean {
  if (typeof action !== "string") return false;
  return (
    BLOCKED_ACTIONS_EVERYWHERE.has(action) ||
    (BLOCKED_ACTIONS_BY_TOOL[toolName] ?? []).includes(action)
  );
}

export function hasBlockedChange(args: Record<string, unknown>): boolean {
  if (
    typeof args.changeStatus === "string" &&
    BLOCKED_CHANGE_STATUS.has(args.changeStatus)
  )
    return true;
  const changes = args.changes;
  return (
    Array.isArray(changes) &&
    changes.some((c) =>
      BLOCKED_CHANGE_STATUS.has(
        (c as { changeStatus?: unknown })?.changeStatus as string,
      ),
    )
  );
}

function refusal(message: string): {
  isError: true;
  content: { type: "text"; text: string }[];
} {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/**
 * Drops blocked action names from the "operations: a, b, c." or
 * "including a, b, and c actions." list in a tool description.
 */
function cleanDescription(toolName: string, description: string): string {
  return description.replace(
    /(operations[^:]*:|including)([^.]*)/,
    (_m, head: string, list: string) => {
      const kept = list
        .split(",")
        .map((item) => item.trim())
        .filter((item) => {
          const name = item.replace(/^and\s+/, "").replace(/\s+actions?$/, "");
          return item && !isActionBlocked(toolName, name);
        });
      return `${head} ${kept.join(", ")}`;
    },
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function narrowAction(toolName: string, schema: any): any {
  const action = schema?.shape?.action;
  if (!action || !Array.isArray(action.options)) return schema;

  const allowed = action.options.filter(
    (o: string) => !isActionBlocked(toolName, o),
  );
  if (allowed.length === action.options.length) return schema;

  return schema.extend({
    action: z
      .enum(allowed as [string, ...string[]])
      .describe(
        `The operation to perform. Must be one of: ${allowed.map((a: string) => `'${a}'`).join(", ")}.`,
      ),
  });
}

/** Removes 'deleted' from the change status enum of `changes` items (bulkUpdate). */
function narrowChanges(schema: any): any {
  const changes = schema?.shape?.changes;
  const array = changes?.unwrap?.() ?? changes;
  const item = array?.element;
  const status = item?.shape?.changeStatus;
  if (!Array.isArray(status?.options)) return schema;

  const allowed = status.options.filter(
    (s: string) => !BLOCKED_CHANGE_STATUS.has(s),
  );
  if (allowed.length === status.options.length) return schema;

  const narrowedItem = item.extend({
    changeStatus: z
      .enum(allowed as [string, ...string[]])
      .describe(status.description ?? "What to do with this entity."),
  });
  let narrowed: any = z.array(narrowedItem);
  if (changes !== array) narrowed = narrowed.optional();
  if (changes.description) narrowed = narrowed.describe(changes.description);
  return schema.extend({ changes: narrowed });
}

function withAddendum(handler: any, text: string): any {
  return async (...args: unknown[]): Promise<any> => {
    const result = await handler(...args);
    if (!result || result.isError) return result;
    return {
      ...result,
      content: [...(result.content ?? []), { type: "text", text }],
    };
  };
}

/** Returns a proxy of `server` that applies the policy to every registerTool call. */
export function withSafetyPolicy(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "registerTool") return Reflect.get(target, prop, receiver);

      return (name: string, config: any, rawHandler: any): any => {
        if (BLOCKED_TOOLS.has(name)) return undefined;

        const addendum = RESULT_ADDENDA[name];
        const handler = addendum
          ? withAddendum(rawHandler, addendum)
          : rawHandler;

        // A tool without an input schema takes no action: nothing to guard.
        if (!config?.inputSchema)
          return (target as any).registerTool(name, config, handler);

        const inputSchema = narrowChanges(
          narrowAction(name, config.inputSchema),
        );
        const actionNarrowed =
          inputSchema.shape?.action !== config.inputSchema.shape?.action;
        const safeConfig = {
          ...config,
          description: actionNarrowed
            ? `${cleanDescription(name, config.description ?? "")}${NOTICE}`
            : config.description,
          inputSchema,
        };

        const safeHandler = async (
          args: Record<string, unknown>,
          extra: unknown,
        ): Promise<unknown> => {
          if (isActionBlocked(name, args?.action)) {
            return refusal(
              `Action '${String(args.action)}' on ${name} is disabled in the Adviso build. Ask the user to do it in the GTM UI.`,
            );
          }
          if (args && hasBlockedChange(args)) {
            return refusal(
              "Changes with status 'deleted' are disabled in the Adviso build. Ask the user to remove the element in the GTM UI.",
            );
          }
          return handler(args, extra);
        };

        return (target as any).registerTool(name, safeConfig, safeHandler);
      };
    },
  });
}
/* eslint-enable @typescript-eslint/no-explicit-any */
