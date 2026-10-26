import {
  createGtmRuntime,
  GtmGoogleError,
  type GtmRuntime,
  type GtmSnapshotBackend,
  type GtmSnapshotResult,
  type GtmSnapshotPageResult,
  ListSnapshotCache,
} from "google-tag-manager-mcp-core";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { createWorkerUsageObserver } from "./gtmUsage";

class GtmCacheUnavailableError extends Error {}

export function createHostedGtmRuntime(
  env: Env,
  props: McpAgentPropsModel,
): GtmRuntime {
  const observer = createWorkerUsageObserver(env);
  if (env.GTM_SNAPSHOT_CACHE_ENABLED !== "true")
    return createGtmRuntime({ enabled: false, observer });
  if (!env.GTM_READ_CACHE)
    throw new Error(
      "GTM_READ_CACHE binding is required when snapshot caching is enabled.",
    );
  const namespace = env.GTM_READ_CACHE;
  const id = namespace.idFromName(
    JSON.stringify([env.GOOGLE_CLIENT_ID, props.userId]),
  );

  async function send<T>(body: Record<string, unknown>): Promise<T> {
    // Cloudflare treats a stub that has thrown as broken, and /sse keeps this
    // runtime for the whole session, so each call takes a fresh stub.
    const response = await namespace
      .get(id)
      .fetch("https://gtm-cache.internal/", {
        method: "POST",
        body: JSON.stringify(body),
      })
      .catch((cause: unknown) => {
        throw new GtmCacheUnavailableError(
          "GTM snapshot cache is unavailable.",
          { cause },
        );
      });
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

  const direct = new ListSnapshotCache({ enabled: false, observer });
  const backend: GtmSnapshotBackend = {
    read: (request) =>
      send<GtmSnapshotResult>({ operation: "read", request }).catch(
        (error: unknown) => {
          if (!(error instanceof GtmCacheUnavailableError)) throw error;
          return direct.read(request);
        },
      ),
    readPage: (request) =>
      send<GtmSnapshotPageResult>({ operation: "readPage", request }).catch(
        (error: unknown) => {
          if (!(error instanceof GtmCacheUnavailableError)) throw error;
          return direct.readPage(request);
        },
      ),
    beginMutation: () => send<string>({ operation: "beginMutation" }),
    endMutation: (id) => send<void>({ operation: "endMutation", id }),
    clear: () => send<void>({ operation: "clear" }),
  };
  return createGtmRuntime({ backend, observer, namespace: props.clientId });
}
