export type GtmQuotaKind = "daily" | "rate" | "unknown" | "none";

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
  cache?: "hit" | "miss" | "coalesced" | "bypass";
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

export async function observeGtmFetch(
  observer: GtmUsageObserver | undefined,
  call: GtmCall,
  attempt: number,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const startedAt = Date.now();
  let status = 0;
  let quota: GtmQuotaKind = "none";
  try {
    const response = await fetch(input, init);
    status = response.status;
    if (status === 403 || status === 429) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      quota = classifyGtmQuota(status, body);
    }
    return response;
  } finally {
    emitGtmUsage(observer, {
      ...call,
      event: "google_attempt",
      status,
      quota,
      attempt,
      durationMs: Date.now() - startedAt,
    });
  }
}

export function describeGtmRequest(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): { method: string; url: string } {
  const request = input instanceof Request ? input : undefined;
  return {
    method: (init?.method ?? request?.method ?? "GET").toUpperCase(),
    url: request?.url ?? String(input),
  };
}

export function createObservedFetch(
  observer: GtmUsageObserver | undefined,
  call: GtmCall,
): typeof fetch {
  const attempts = new Map<string, number>();
  return (input, init) => {
    const { method, url } = describeGtmRequest(input, init);
    const key = `${method} ${url}`;
    const attempt = (attempts.get(key) ?? 0) + 1;
    attempts.set(key, attempt);
    return observeGtmFetch(observer, call, attempt, input, init);
  };
}
