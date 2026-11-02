import {
  createGtmRuntime,
  GtmGoogleError,
  type GtmRuntime,
  type GtmSnapshotBackend,
  type GtmSnapshotResult,
  type GtmSnapshotPageResult,
  withGtmAbort,
  withGtmCacheTimeout,
} from "google-tag-manager-mcp-core";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { createWorkerUsageObserver } from "./gtmUsage";
import { createHostedGtmScheduler } from "./createHostedGtmScheduler";

class GtmCacheUnavailableError extends Error {}

export function createHostedGtmRuntime(
  env: Env,
  props: McpAgentPropsModel,
): GtmRuntime {
  const observer = createWorkerUsageObserver(env);
  const scheduler = createHostedGtmScheduler(env);
  if (env.GTM_SNAPSHOT_CACHE_ENABLED !== "true")
    return createGtmRuntime({ enabled: false, observer, scheduler });
  if (!env.GTM_READ_CACHE)
    throw new Error(
      "GTM_READ_CACHE binding is required when snapshot caching is enabled.",
    );
  const namespace = env.GTM_READ_CACHE;
  const id = namespace.idFromName(
    JSON.stringify([env.GOOGLE_CLIENT_ID, props.userId]),
  );

  async function send<T>(
    body: Record<string, unknown>,
    signal?: AbortSignal,
    cancelId?: string,
  ): Promise<T> {
    // Cloudflare treats a stub that has thrown as broken, and /sse keeps this
    // runtime for the whole session, so each call takes a fresh stub.
    const pending = namespace.get(id).fetch("https://gtm-cache.internal/", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
    let response: Response;
    try {
      response = await (signal ? withGtmAbort(pending, signal) : pending);
    } catch (cause) {
      if (signal?.aborted && cancelId) {
        // DO subrequest aborts do not reliably propagate into the object's
        // Request.signal. Explicitly cancel this waiter before returning.
        await withGtmCacheTimeout(() =>
          namespace.get(id).fetch("https://gtm-cache.internal/", {
            method: "POST",
            body: JSON.stringify({ operation: "cancel", callId: cancelId }),
          }),
        ).catch(() => {});
      }
      throw new GtmCacheUnavailableError("GTM snapshot cache is unavailable.", {
        cause,
      });
    }
    if (!response.ok)
      throw new GtmCacheUnavailableError("GTM snapshot cache is unavailable.");
    const payload = (await response.json()) as {
      result: T;
      error?: { code?: number; message: string };
    };
    if (payload.error) {
      if (payload.error.code)
        throw new GtmGoogleError(payload.error.code, payload.error.message);
      throw new Error(payload.error.message);
    }
    return payload.result;
  }

  const backend: GtmSnapshotBackend = {
    read: (request) =>
      send<GtmSnapshotResult>(
        { operation: "read", request: { ...request, signal: undefined } },
        request.signal,
        request.call.callId,
      ),
    readPage: (request) =>
      send<GtmSnapshotPageResult>(
        { operation: "readPage", request: { ...request, signal: undefined } },
        request.signal,
        request.call.callId,
      ),
    beginMutation: (id) => send<string>({ operation: "beginMutation", id }),
    endMutation: (id) => send<void>({ operation: "endMutation", id }),
    clear: () => send<void>({ operation: "clear" }),
  };
  return createGtmRuntime({
    backend,
    observer,
    scheduler,
    namespace: props.clientId,
  });
}
