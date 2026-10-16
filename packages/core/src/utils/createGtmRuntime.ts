import { GtmAuthProvider } from "../types/index.js";
import {
  emitGtmUsage,
  GtmUsageObserver,
  observeGtmFetch,
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

export function createGtmRuntime(
  options: {
    backend?: GtmSnapshotBackend;
    observer?: GtmUsageObserver;
    namespace?: string;
    enabled?: boolean;
  } = {},
): GtmRuntime {
  const backend =
    options.backend ??
    new ListSnapshotCache({
      enabled: options.enabled,
      observer: options.observer,
    });
  return {
    clear: () => backend.clear(),
    startCall(auth, tool, action): GtmInvocation {
      const call = { tool, action, callId: crypto.randomUUID() };
      emitGtmUsage(options.observer, { ...call, event: "tool_call" });
      const attempts = new Map<string, number>();
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
          const request = new Request(input, init);
          const key = `${request.method} ${request.url}`;
          const attempt = (attempts.get(key) ?? 0) + 1;
          attempts.set(key, attempt);
          const mutation =
            request.method !== "GET" && request.method !== "HEAD";
          const id = mutation ? await backend.beginMutation() : undefined;
          try {
            return await observeGtmFetch(
              options.observer,
              call,
              attempt,
              input,
              init,
            );
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
