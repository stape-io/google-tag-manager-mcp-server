import type { tagmanager_v2 } from "@googleapis/tagmanager";

export type GtmQuotaKind = "daily" | "rate" | "unknown" | "none";

export type GtmCacheOutcome = "hit" | "miss" | "coalesced" | "bypass";

export interface GtmCall {
  tool: string;
  action: string;
  callId: string;
}

export interface GtmUsageEvent extends GtmCall {
  event:
    | "tool_call"
    | "google_attempt"
    | "snapshot"
    | "snapshot_wait"
    | "invalidation_error";
  status?: number;
  durationMs?: number;
  attempt?: number;
  quota?: GtmQuotaKind;
  cache?: GtmCacheOutcome;
}

export type GtmUsageObserver = (event: GtmUsageEvent) => void;

export function emitGtmUsage(
  observer: GtmUsageObserver | undefined,
  event: GtmUsageEvent,
): void {
  try {
    observer?.(event);
  } catch {
    // Telemetry delivery cannot turn a completed Google operation into a retry.
  }
}

export function classifyGtmQuota(status: number, body: unknown): GtmQuotaKind {
  if (status !== 403 && status !== 429) return "none";
  const detail = JSON.stringify(body ?? "");
  if (/queries per day|dailyLimitExceeded|QueriesPerDay|per.day/i.test(detail))
    return "daily";
  if (
    /rateLimitExceeded|userRateLimitExceeded|per.minute|per.second|QueriesPer100Seconds/i.test(
      detail,
    )
  )
    return "rate";
  return status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(detail)
    ? "unknown"
    : "none";
}

type GtmClientOptions = ConstructorParameters<
  typeof tagmanager_v2.Tagmanager
>[0];
export type GtmRequestAdapter = NonNullable<GtmClientOptions["adapter"]>;

export const gtmRetryConfig: GtmClientOptions["retryConfig"] = {
  shouldRetry: (error) => {
    const attempt = error.config?.retryConfig?.currentRetryAttempt ?? 0;
    const status = error.response?.status ?? 0;
    if (error.config?.signal?.aborted || error.code === "AbortError")
      return false;
    if (classifyGtmQuota(status, error.response?.data) === "daily")
      return false;
    return (
      attempt < (status === 0 ? 2 : 3) &&
      (status === 0 ||
        status === 408 ||
        status === 429 ||
        (status >= 500 && status <= 599))
    );
  },
};

export function createObservedGtmAdapter(
  observer: GtmUsageObserver | undefined,
  call: GtmCall,
): GtmRequestAdapter {
  return async (options, defaultAdapter) => {
    const startedAt = Date.now();
    let status = 0;
    let quota: GtmQuotaKind = "none";
    try {
      const response = await defaultAdapter(options);
      status = response.status;
      quota = classifyGtmQuota(status, response.data);
      if (quota === "daily") {
        options.retryConfig = { ...options.retryConfig, retry: 0 };
      }
      return response;
    } finally {
      emitGtmUsage(observer, {
        ...call,
        event: "google_attempt",
        status,
        quota,
        attempt: (options.retryConfig?.currentRetryAttempt ?? 0) + 1,
        durationMs: Date.now() - startedAt,
      });
    }
  };
}
