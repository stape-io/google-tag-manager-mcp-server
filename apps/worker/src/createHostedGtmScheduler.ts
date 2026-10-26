import {
  GtmSchedulingError,
  waitForGtm,
  type GtmRequestScheduler,
} from "google-tag-manager-mcp-core";

export function createHostedGtmScheduler(
  env: Env,
): GtmRequestScheduler | undefined {
  if (env.GTM_REQUEST_SCHEDULER_ENABLED !== "true") return undefined;
  if (!env.GTM_REQUEST_COORDINATOR || !env.GTM_QUOTA_PROJECT_ID)
    throw new Error(
      "GTM request scheduling requires GTM_REQUEST_COORDINATOR and GTM_QUOTA_PROJECT_ID.",
    );
  const namespace = env.GTM_REQUEST_COORDINATOR;
  const id = namespace.idFromName(env.GTM_QUOTA_PROJECT_ID);
  return {
    async acquire({ signal, deadline }): Promise<void> {
      for (;;) {
        if (signal?.aborted) throw signal.reason;
        const response = await namespace
          .get(id)
          .fetch("https://gtm-scheduler.internal/acquire", {
            method: "POST",
            body: JSON.stringify({ deadline }),
            signal,
          });
        const result = (await response.json()) as {
          at?: number;
          expiresAt?: number;
          error?: string;
        };
        if (!response.ok) {
          if (result.error === "full" || result.error === "deadline")
            throw new GtmSchedulingError(result.error);
          throw new Error(
            "GTM request coordinator is unavailable. Try again later.",
          );
        }
        if (
          typeof result.at !== "number" ||
          !Number.isFinite(result.at) ||
          result.at >= deadline ||
          typeof result.expiresAt !== "number" ||
          !Number.isFinite(result.expiresAt) ||
          result.expiresAt < result.at
        )
          throw new Error(
            "GTM request coordinator returned an invalid reservation.",
          );
        const remaining = Math.max(0, result.at - Date.now());
        if (signal) await waitForGtm(remaining, signal);
        else await new Promise((resolve) => setTimeout(resolve, remaining));
        if (signal?.aborted) throw signal.reason;
        if (Date.now() >= deadline) throw new GtmSchedulingError("deadline");
        // A suspended or slow caller must not spend an old permit alongside
        // newer ones after resuming. Unused reservations simply expire.
        if (Date.now() > result.expiresAt) continue;
        return;
      }
    },
  };
}
