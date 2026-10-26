import { McpServer } from "@modelcontextprotocol/server";
import { GtmAuthProvider } from "../types/index.js";
import {
  createObservedGtmAdapter,
  type GtmRequestAdapter,
  emitGtmUsage,
  GtmUsageObserver,
} from "./gtmTelemetry.js";
import {
  GTM_CACHE_READ_TIMEOUT_MS,
  withGtmCacheTimeout,
} from "./gtmCacheTimeout.js";
import {
  GtmSnapshotBackend,
  GtmSnapshotItem,
  GtmSnapshotRequest,
  GtmSnapshotResult,
  GtmSnapshotPageRequest,
  GtmSnapshotPageResult,
  ListSnapshotCache,
} from "./listSnapshotCache.js";
import { paginateArray, type PaginationResult } from "./paginationUtils.js";
import type { GtmRequestScheduler } from "./gtmRequestScheduler.js";
import {
  createScheduledGtmAdapter,
  GTM_REQUEST_DEADLINE_MS,
} from "./gtmScheduledAdapter.js";

export interface GtmInvocation {
  adapter: GtmRequestAdapter;
  listSnapshot(path: string, fresh: boolean): Promise<GtmSnapshotItem[]>;
  listPage(
    path: string,
    fresh: boolean,
    page: number,
    itemsPerPage: number,
  ): Promise<PaginationResult<GtmSnapshotItem>>;
}

export interface GtmRuntime {
  startCall(
    auth: GtmAuthProvider,
    tool: string,
    action: string,
    signal?: AbortSignal,
  ): GtmInvocation;
  clear(): Promise<void>;
}

// `folders.entities` lists a folder's contents over POST.
const READ_ONLY_POST = /:entities$/;

function isGtmMutation(method: string, url: URL): boolean {
  if (method === "GET" || method === "HEAD") return false;
  return !(method === "POST" && READ_ONLY_POST.test(url.pathname));
}

export function createGtmRuntime(
  options: {
    backend?: GtmSnapshotBackend;
    observer?: GtmUsageObserver;
    namespace?: string;
    enabled?: boolean;
    scheduler?: GtmRequestScheduler;
  } = {},
): GtmRuntime {
  const backend =
    options.backend && options.enabled !== false
      ? options.backend
      : new ListSnapshotCache({
          enabled: options.enabled,
          observer: options.observer,
          scheduler: options.scheduler,
        });
  async function read(request: GtmSnapshotRequest): Promise<GtmSnapshotResult> {
    if (!options.backend || options.enabled === false)
      return backend.read(request);
    // A timed-out backend may still be fetching Google pages. Starting a
    // fallback scan would duplicate that work and consume more quota.
    return withGtmCacheTimeout(
      () => backend.read(request),
      GTM_CACHE_READ_TIMEOUT_MS,
    );
  }
  async function readPage(
    request: GtmSnapshotPageRequest,
  ): Promise<GtmSnapshotPageResult> {
    if (backend.readPage) {
      if (!options.backend || options.enabled === false)
        return backend.readPage(request);
      return withGtmCacheTimeout(
        () => backend.readPage!(request),
        GTM_CACHE_READ_TIMEOUT_MS,
      );
    }
    const { items, cache } = await read(request);
    return {
      ...paginateArray(items, request.page, request.itemsPerPage),
      cache,
    };
  }
  return {
    clear: () => withGtmCacheTimeout(() => backend.clear()),
    startCall(auth, tool, action, signal): GtmInvocation {
      const call = { tool, action, callId: crypto.randomUUID() };
      const deadline = Date.now() + GTM_REQUEST_DEADLINE_MS;
      emitGtmUsage(options.observer, { ...call, event: "tool_call" });
      const observedAdapter = options.scheduler
        ? createScheduledGtmAdapter(
            options.scheduler,
            options.observer,
            call,
            deadline,
            signal,
          )
        : createObservedGtmAdapter(options.observer, call);
      const adapter: GtmRequestAdapter = async (request, defaultAdapter) => {
        const mutation = isGtmMutation(
          (request.method ?? "GET").toUpperCase(),
          request.url,
        );
        let id: string | undefined;
        const invalidationFailed = (): void =>
          emitGtmUsage(options.observer, {
            ...call,
            event: "invalidation_error",
          });
        if (mutation) {
          try {
            id = await withGtmCacheTimeout(() => backend.beginMutation());
          } catch {
            invalidationFailed();
          }
        }
        try {
          return await observedAdapter(request, defaultAdapter);
        } finally {
          if (mutation) {
            await withGtmCacheTimeout(() =>
              id ? backend.endMutation(id) : backend.clear(),
            ).catch(invalidationFailed);
          }
        }
      };
      return {
        async listSnapshot(path, fresh): Promise<GtmSnapshotItem[]> {
          const token = await auth.getAccessToken();
          const startedAt = Date.now();
          const result = await read({
            path,
            token,
            namespace: options.namespace ?? "",
            fresh,
            call,
            signal,
            deadline,
          });
          emitGtmUsage(options.observer, {
            ...call,
            event: "snapshot",
            cache: result.cache,
            durationMs: Date.now() - startedAt,
          });
          return result.items;
        },
        async listPage(
          path,
          fresh,
          page,
          itemsPerPage,
        ): Promise<PaginationResult<GtmSnapshotItem>> {
          const token = await auth.getAccessToken();
          const startedAt = Date.now();
          const result = await readPage({
            path,
            token,
            namespace: options.namespace ?? "",
            fresh,
            call,
            page,
            itemsPerPage,
            signal,
            deadline,
          });
          emitGtmUsage(options.observer, {
            ...call,
            event: "snapshot",
            cache: result.cache,
            durationMs: Date.now() - startedAt,
          });
          return { data: result.data, pagination: result.pagination };
        },
        adapter,
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
