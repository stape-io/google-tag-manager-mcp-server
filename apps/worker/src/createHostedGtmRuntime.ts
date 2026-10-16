import {
  createGtmRuntime,
  GtmGoogleError,
  type GtmRuntime,
  type GtmSnapshotBackend,
  type GtmSnapshotResult,
} from "google-tag-manager-mcp-core";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { createWorkerUsageObserver } from "./gtmUsage";

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
  const stub = env.GTM_READ_CACHE.get(
    env.GTM_READ_CACHE.idFromName(
      JSON.stringify([env.GOOGLE_CLIENT_ID, props.userId]),
    ),
  );

  async function send<T>(body: Record<string, unknown>): Promise<T> {
    const response = await stub.fetch("https://gtm-cache.internal/", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("GTM snapshot cache is unavailable.");
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
    read: (request) => send<GtmSnapshotResult>({ operation: "read", request }),
    beginMutation: () => send<string>({ operation: "beginMutation" }),
    endMutation: (id) => send<void>({ operation: "endMutation", id }),
    clear: () => send<void>({ operation: "clear" }),
  };
  return createGtmRuntime({ backend, observer, namespace: props.clientId });
}
