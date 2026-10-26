import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";

afterEach(() => vi.useRealTimers());

describe("GTM request scheduling", () => {
  it("keeps the default pacing below 25 attempts in every 100-second window", async () => {
    vi.useFakeTimers({ now: 0 });
    const scheduler = new LocalGtmRequestScheduler({ maxPending: 30 });
    const times: number[] = [];
    const pending = Array.from({ length: 26 }, async () => {
      await scheduler.acquire({ deadline: 200_000 });
      times.push(Date.now());
    });
    await vi.advanceTimersByTimeAsync(103_000);
    await Promise.all(pending);
    for (const at of times)
      expect(
        times.filter((time) => time >= at && time < at + 100_000).length,
      ).toBeLessThanOrEqual(25);
  });
  it("paces concurrent users in FIFO order at one permit per interval", async () => {
    vi.useFakeTimers({ now: 0 });
    const scheduler = new LocalGtmRequestScheduler({ intervalMs: 4_100 });
    const grants: { user: number; at: number }[] = [];
    const pending = [1, 2, 3].map(async (user) => {
      await scheduler.acquire({ deadline: 20_000 });
      grants.push({ user, at: Date.now() });
    });
    await vi.advanceTimersByTimeAsync(8_200);
    await Promise.all(pending);
    expect(grants).toEqual([
      { user: 1, at: 0 },
      { user: 2, at: 4_100 },
      { user: 3, at: 8_200 },
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds pending work and recovers capacity when a queued request is cancelled", async () => {
    vi.useFakeTimers({ now: 0 });
    const scheduler = new LocalGtmRequestScheduler({
      intervalMs: 100,
      maxPending: 1,
    });
    await scheduler.acquire({ deadline: 1_000 });
    const controller = new AbortController();
    const cancelled = expect(
      scheduler.acquire({ deadline: 1_000, signal: controller.signal }),
    ).rejects.toMatchObject({ reason: "cancelled" });
    await expect(scheduler.acquire({ deadline: 1_000 })).rejects.toMatchObject({
      reason: "full",
    });
    controller.abort();
    await cancelled;
    const next = scheduler.acquire({ deadline: 1_000 });
    await vi.advanceTimersByTimeAsync(100);
    await next;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("expires abandoned work without consuming the next permit", async () => {
    vi.useFakeTimers({ now: 0 });
    const scheduler = new LocalGtmRequestScheduler({ intervalMs: 100 });
    await scheduler.acquire({ deadline: 1_000 });
    const expired = expect(
      scheduler.acquire({ deadline: 50 }),
    ).rejects.toMatchObject({ reason: "deadline" });
    const next = vi.fn();
    const pending = scheduler.acquire({ deadline: 1_000 }).then(next);
    await vi.advanceTimersByTimeAsync(50);
    await expired;
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(50);
    await pending;
    expect(next).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps independent project coordinators independent", async () => {
    vi.useFakeTimers({ now: 0 });
    const first = new LocalGtmRequestScheduler();
    const second = new LocalGtmRequestScheduler();
    await first.acquire({ deadline: 1_000 });
    await second.acquire({ deadline: 1_000 });
    expect(Date.now()).toBe(0);
  });

  it("does not accumulate burst credits while idle", async () => {
    vi.useFakeTimers({ now: 0 });
    const scheduler = new LocalGtmRequestScheduler({ intervalMs: 100 });
    await scheduler.acquire({ deadline: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    await scheduler.acquire({ deadline: 2_000 });
    const next = vi.fn();
    const pending = scheduler.acquire({ deadline: 2_000 }).then(next);
    await vi.advanceTimersByTimeAsync(99);
    expect(next).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
  });
});
