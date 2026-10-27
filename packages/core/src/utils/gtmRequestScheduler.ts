export interface GtmScheduleRequest {
  signal?: AbortSignal;
  deadline: number;
}

/** SDK v2 nests request state; the legacy SSE bridge supplies v1 extras. */
export function getGtmRequestSignal(context: {
  mcpReq?: { signal?: AbortSignal };
  signal?: AbortSignal;
}): AbortSignal | undefined {
  return context.mcpReq?.signal ?? context.signal;
}

/** One permit per actual upstream attempt, including retries and list pages. */
export interface GtmRequestScheduler {
  acquire(request: GtmScheduleRequest): Promise<void>;
}

export function withGtmAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new GtmSchedulingError("cancelled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}

export class GtmSchedulingError extends Error {
  constructor(
    public readonly reason: "full" | "deadline" | "cancelled",
    options?: ErrorOptions,
  ) {
    const context =
      options?.cause instanceof Error
        ? ` Previous upstream failure: ${options.cause.message}`
        : "";
    super(
      (reason === "full"
        ? "GTM request queue is full. Try again later."
        : reason === "deadline"
          ? "GTM request deadline exceeded while waiting. Try again later."
          : "GTM request cancelled.") + context,
      options,
    );
  }
}

interface Waiter {
  request: GtmScheduleRequest;
  finish(error?: Error): void;
}

/** FIFO pacing within one process. Hosted callers share a project coordinator. */
export class LocalGtmRequestScheduler implements GtmRequestScheduler {
  private readonly queue: Waiter[] = [];
  private nextAt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private pumping = false;

  constructor(
    private readonly options: {
      intervalMs?: number;
      maxPending?: number;
    } = {},
  ) {
    if (
      !Number.isFinite(options.intervalMs ?? 4_100) ||
      (options.intervalMs ?? 4_100) < 1 ||
      !Number.isInteger(options.maxPending ?? 25) ||
      (options.maxPending ?? 25) < 1
    )
      throw new Error("Invalid GTM scheduler configuration.");
  }

  acquire(request: GtmScheduleRequest): Promise<void> {
    if (request.signal?.aborted)
      return Promise.reject(new GtmSchedulingError("cancelled"));
    if (!Number.isFinite(request.deadline) || request.deadline <= Date.now())
      return Promise.reject(new GtmSchedulingError("deadline"));
    if (this.queue.length >= (this.options.maxPending ?? 25))
      return Promise.reject(new GtmSchedulingError("full"));

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const abort = (): void =>
        waiter.finish(new GtmSchedulingError("cancelled"));
      const timeout = setTimeout(
        () => waiter.finish(new GtmSchedulingError("deadline")),
        request.deadline - Date.now(),
      );
      const waiter: Waiter = {
        request,
        finish: (error): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          request.signal?.removeEventListener("abort", abort);
          const index = this.queue.indexOf(waiter);
          if (index !== -1) this.queue.splice(index, 1);
          if (error) reject(error);
          else resolve();
          this.pump();
        },
      };
      request.signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(waiter);
      // Abort may have happened between the initial check and registration.
      if (request.signal?.aborted) abort();
      else this.pump();
    });
  }

  private pump(): void {
    if (this.pumping) return;
    this.pumping = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    try {
      while (this.queue.length) {
        const waiter = this.queue[0];
        if (waiter.request.signal?.aborted) {
          waiter.finish(new GtmSchedulingError("cancelled"));
          continue;
        }
        const now = Date.now();
        if (waiter.request.deadline <= now) {
          waiter.finish(new GtmSchedulingError("deadline"));
          continue;
        }
        if (this.nextAt > now) {
          this.timer = setTimeout(() => this.pump(), this.nextAt - now);
          return;
        }
        this.nextAt = now + (this.options.intervalMs ?? 4_100);
        waiter.finish();
      }
    } finally {
      this.pumping = false;
    }
  }
}
