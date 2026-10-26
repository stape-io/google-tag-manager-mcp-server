import {
  classifyGtmQuota,
  createObservedGtmAdapter,
  emitGtmUsage,
  type GtmCall,
  type GtmRequestAdapter,
  type GtmUsageObserver,
} from "./gtmTelemetry.js";
import {
  GtmSchedulingError,
  withGtmAbort,
  type GtmRequestScheduler,
} from "./gtmRequestScheduler.js";

export const GTM_REQUEST_DEADLINE_MS = 25_000;

export function waitForGtm(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new GtmSchedulingError("cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Owns retries so every upstream attempt has exactly one scheduling permit. */
export function createScheduledGtmAdapter(
  scheduler: GtmRequestScheduler,
  observer: GtmUsageObserver | undefined,
  call: GtmCall,
  deadline = Date.now() + GTM_REQUEST_DEADLINE_MS,
  callerSignal?: AbortSignal,
): GtmRequestAdapter {
  const observed = createObservedGtmAdapter(observer, call);
  return async (options, defaultAdapter) => {
    // gaxios would otherwise add an independent outer retry loop.
    options.retry = false;
    options.retryConfig = { retry: 0, shouldRetry: (): boolean => false };
    if (deadline <= Date.now()) throw new GtmSchedulingError("deadline");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new GtmSchedulingError("deadline")),
      deadline - Date.now(),
    );
    const signal = AbortSignal.any([
      controller.signal,
      ...[options.signal, callerSignal].filter((value): value is AbortSignal =>
        Boolean(value),
      ),
    ]);
    const method = (options.method ?? "GET").toUpperCase();
    const safeRead =
      method === "GET" ||
      method === "HEAD" ||
      (method === "POST" && options.url.pathname.endsWith(":entities"));
    try {
      for (let attempt = 0; ; attempt++) {
        const queuedAt = Date.now();
        try {
          await withGtmAbort(scheduler.acquire({ signal, deadline }), signal);
        } catch (error) {
          emitGtmUsage(observer, {
            ...call,
            event: "queue_rejected",
            durationMs: Date.now() - queuedAt,
          });
          throw error;
        }
        if (signal.aborted) throw signal.reason;
        if (deadline <= Date.now()) throw new GtmSchedulingError("deadline");
        emitGtmUsage(observer, {
          ...call,
          event: "queue_wait",
          durationMs: Date.now() - queuedAt,
        });
        options.signal = signal;
        options.retryConfig = {
          ...options.retryConfig,
          currentRetryAttempt: attempt,
        };
        let status = 0;
        let quota: ReturnType<typeof classifyGtmQuota> = "none";
        let retryAfter = 0;
        try {
          const response = await withGtmAbort(
            observed(options, defaultAdapter),
            signal,
          );
          status = response.status;
          quota = classifyGtmQuota(status, response.data);
          const temporaryQuota =
            quota === "rate" ||
            (status === 429 && quota === "unknown" && safeRead);
          const temporaryReadFailure =
            safeRead && (status === 408 || (status >= 500 && status <= 599));
          if (
            attempt >= 3 ||
            quota === "daily" ||
            !(temporaryQuota || temporaryReadFailure)
          )
            return response;
          const header = response.headers.get("retry-after");
          if (header)
            retryAfter = /^\d+(\.\d+)?$/.test(header)
              ? Number(header) * 1_000
              : Math.max(0, Date.parse(header) - Date.now());
        } catch (error) {
          if (signal.aborted) throw signal.reason;
          // A failed write may already have committed. Never replay it after
          // an ambiguous transport failure (including deletes and updates).
          if (!safeRead || attempt >= 2) throw error;
        }
        const backoff = Math.max(
          retryAfter || 0,
          1_000 * 2 ** attempt + Math.floor(Math.random() * 251),
        );
        if (Date.now() + backoff >= deadline)
          throw new GtmSchedulingError("deadline");
        emitGtmUsage(observer, {
          ...call,
          event: "retry_wait",
          status,
          quota,
          attempt: attempt + 1,
          durationMs: backoff,
        });
        await waitForGtm(backoff, signal);
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
