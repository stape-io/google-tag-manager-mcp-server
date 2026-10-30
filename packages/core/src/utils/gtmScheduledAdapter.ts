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
import { isGtmReadOnlyRequest } from "./gtmRequestPolicy.js";

export const GTM_REQUEST_DEADLINE_MS = 25_000;
export const GTM_LIST_DEADLINE_MS = 5 * 60_000;

function upstreamResponseError(status: number, body: unknown): Error {
  const detail = body as { error?: { message?: unknown } } | null;
  const message =
    typeof detail?.error?.message === "string"
      ? `: ${detail.error.message}`
      : "";
  // Preserve diagnostics without retaining request headers or credentials.
  return new Error(`Google API ${status}${message}`);
}

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
  operationDeadline = Date.now() + GTM_REQUEST_DEADLINE_MS,
  callerSignal?: AbortSignal,
): GtmRequestAdapter {
  const observed = createObservedGtmAdapter(observer, call);
  return async (options, defaultAdapter) => {
    const deadline = Math.min(
      operationDeadline,
      Date.now() + GTM_REQUEST_DEADLINE_MS,
    );
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
    const safeRead = isGtmReadOnlyRequest(method, options.url);
    let lastUpstreamError: Error | undefined;
    try {
      for (let attempt = 0; ; attempt++) {
        const queuedAt = Date.now();
        try {
          await withGtmAbort(scheduler.acquire({ signal, deadline }), signal);
        } catch (error) {
          emitGtmUsage(observer, {
            ...call,
            event:
              (error instanceof GtmSchedulingError &&
                error.reason === "cancelled") ||
              (signal.aborted &&
                !(
                  signal.reason instanceof GtmSchedulingError &&
                  signal.reason.reason === "deadline"
                ))
                ? "queue_cancelled"
                : "queue_rejected",
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
        let backoff = 1_000 * 2 ** attempt + Math.floor(Math.random() * 251);
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
          backoff = Math.max(retryAfter || 0, backoff);
          // Preserve Google's response when its retry delay exceeds our budget.
          if (Date.now() + backoff >= deadline) return response;
          lastUpstreamError = upstreamResponseError(status, response.data);
        } catch (error) {
          if (signal.aborted) throw signal.reason;
          lastUpstreamError =
            error instanceof Error ? error : new Error(String(error));
          // A failed write may already have committed. Never replay it after
          // an ambiguous transport failure (including deletes and updates).
          if (!safeRead || attempt >= 2) throw error;
        }
        if (Date.now() + backoff >= deadline) {
          throw new GtmSchedulingError("deadline");
        }
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
    } catch (error) {
      const userCancelled =
        signal.aborted &&
        !(
          signal.reason instanceof GtmSchedulingError &&
          signal.reason.reason === "deadline"
        );
      if (lastUpstreamError && error !== lastUpstreamError && !userCancelled) {
        if (error instanceof GtmSchedulingError)
          throw new GtmSchedulingError(error.reason, {
            cause: lastUpstreamError,
          });
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${message} Previous upstream failure: ${lastUpstreamError.message}`,
          { cause: lastUpstreamError },
        );
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
