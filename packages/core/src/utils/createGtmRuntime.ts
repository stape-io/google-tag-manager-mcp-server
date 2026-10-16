import { McpServer } from "@modelcontextprotocol/server";
import { GtmAuthProvider } from "../types/index.js";
import {
  createObservedFetch,
  describeGtmRequest,
  emitGtmUsage,
  GtmUsageObserver,
} from "./gtmTelemetry.js";
import {
  GtmSnapshotBackend,
  GtmSnapshotItem,
  ListSnapshotCache,
} from "./listSnapshotCache.js";

export interface GtmInvocation {
  fetch: typeof fetch;
  listSnapshot(path: string, fresh: boolean): Promise<GtmSnapshotItem[]>;
}

export interface GtmRuntime {
  startCall(auth: GtmAuthProvider, tool: string, action: string): GtmInvocation;
  clear(): Promise<void>;
}

// `folders.entities` lists a folder's contents over POST.
const READ_ONLY_POST = /:entities$/;

function isGtmMutation(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): boolean {
  const { method, url } = describeGtmRequest(input, init);
  if (method === "GET" || method === "HEAD") return false;
  return !(method === "POST" && READ_ONLY_POST.test(new URL(url).pathname));
}

export function createGtmRuntime(
  options: {
    backend?: GtmSnapshotBackend;
    observer?: GtmUsageObserver;
    namespace?: string;
    enabled?: boolean;
  } = {},
): GtmRuntime {
  const backend =
    options.backend && options.enabled !== false
      ? options.backend
      : new ListSnapshotCache({
          enabled: options.enabled,
          observer: options.observer,
        });
  return {
    clear: () => backend.clear(),
    startCall(auth, tool, action): GtmInvocation {
      const call = { tool, action, callId: crypto.randomUUID() };
      emitGtmUsage(options.observer, { ...call, event: "tool_call" });
      const observedFetch = createObservedFetch(options.observer, call);
      return {
        async listSnapshot(path, fresh): Promise<GtmSnapshotItem[]> {
          const token = await auth.getAccessToken();
          const startedAt = Date.now();
          const result = await backend.read({
            path,
            token,
            namespace: options.namespace ?? "",
            fresh,
            call,
          });
          emitGtmUsage(options.observer, {
            ...call,
            event: "snapshot",
            cache: result.cache,
            durationMs: Date.now() - startedAt,
          });
          return result.items;
        },
        async fetch(input, init): Promise<Response> {
          const id = isGtmMutation(input, init)
            ? await backend.beginMutation()
            : undefined;
          try {
            return await observedFetch(input, init);
          } finally {
            if (id) {
              await backend.endMutation(id).catch(() => {
                emitGtmUsage(options.observer, {
                  ...call,
                  event: "invalidation_error",
                });
              });
            }
          }
        },
      };
    },
  };
}

const serverRuntimes = new WeakMap<McpServer, GtmRuntime>();

export function getServerGtmRuntime(server: McpServer): GtmRuntime {
  let runtime = serverRuntimes.get(server);
  if (!runtime) {
    runtime = createGtmRuntime();
    serverRuntimes.set(server, runtime);
  }
  return runtime;
}
