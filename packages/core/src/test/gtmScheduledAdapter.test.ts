import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarness, type McpHarness } from "./mcpHarness.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import type { GtmUsageEvent } from "../utils/gtmTelemetry.js";

const api = useGoogleApiStub();
const harnesses: McpHarness[] = [];
const args = { accountId: "1", containerId: "2", workspaceId: "3" };
async function open(
  events: GtmUsageEvent[] = [],
): Promise<McpHarness["client"]> {
  const harness = await createHarness({
    runtime: createGtmRuntime({
      scheduler: new LocalGtmRequestScheduler({ intervalMs: 100 }),
      observer: (event) => events.push(event),
    }),
  });
  harnesses.push(harness);
  return harness.client;
}
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

describe("scheduled Google transport", () => {
  it("caps repeated temporary quota failures at four actual attempts", async () => {
    const events: GtmUsageEvent[] = [];
    const client = await open(events);
    vi.useFakeTimers({ now: 0 });
    api.respond = (): Response =>
      json({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403);
    const pending = client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "get", tagId: "4" },
    });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).isError).toBe(true);
    expect(api.calls).toHaveLength(4);
    expect(
      events
        .filter((event) => event.event === "google_attempt")
        .map((event) => event.attempt),
    ).toEqual([1, 2, 3, 4]);
  });

  it("does not retry when Retry-After exceeds the remaining deadline", async () => {
    const client = await open();
    api.respond = (): Response =>
      new Response(JSON.stringify({ error: { message: "busy" } }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "60" },
      });
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "get", tagId: "4" },
    });
    expect(result.isError).toBe(true);
    expect(api.calls).toHaveLength(1);
  });
  it("bounds a coordinator that never answers without bypassing scheduling", async () => {
    const entered = vi.fn();
    const harness = await createHarness({
      runtime: createGtmRuntime({
        scheduler: {
          acquire: (): Promise<void> => {
            entered();
            return new Promise(() => {});
          },
        },
      }),
    });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    const pending = harness.client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "get", tagId: "4" },
    });
    await vi.waitFor(() => expect(entered).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(25_000);
    expect((await pending).isError).toBe(true);
    expect(api.calls).toHaveLength(0);
  });
  it("propagates MCP cancellation to a queued ordinary request", async () => {
    const scheduler = new LocalGtmRequestScheduler({ intervalMs: 1_000 });
    const events: GtmUsageEvent[] = [];
    const harness = await createHarness({
      runtime: createGtmRuntime({
        scheduler,
        observer: (event) => events.push(event),
      }),
    });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    await scheduler.acquire({ deadline: 10_000 });
    const controller = new AbortController();
    const rejected = expect(
      harness.client.callTool(
        { name: "gtm_tag", arguments: { ...args, action: "get", tagId: "4" } },
        { signal: controller.signal },
      ),
    ).rejects.toBeDefined();
    await vi.waitFor(() =>
      expect(events.some((event) => event.event === "tool_call")).toBe(true),
    );
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(api.calls).toHaveLength(0);
  });

  it.each([false, true])(
    "cancels shared snapshot work only when all waiters leave (all=%s)",
    async (cancelAll) => {
      vi.useFakeTimers({ now: 0 });
      const scheduler = new LocalGtmRequestScheduler({ intervalMs: 1_000 });
      await scheduler.acquire({ deadline: 10_000 });
      const events: GtmUsageEvent[] = [];
      const runtime = createGtmRuntime({
        scheduler,
        observer: (event) => events.push(event),
      });
      const auth = {
        getAccessToken: async (): Promise<string> => "shared-token",
      };
      const first = new AbortController();
      const second = new AbortController();
      const one = runtime
        .startCall(auth, "gtm_tag", "list", first.signal)
        .listSnapshot("accounts/1/containers/2/workspaces/3/tags", false);
      const two = runtime
        .startCall(auth, "gtm_tag", "list", second.signal)
        .listSnapshot("accounts/1/containers/2/workspaces/3/tags", false);
      const oneRejected = expect(one).rejects.toBeDefined();
      const twoResult = cancelAll ? expect(two).rejects.toBeDefined() : two;
      await vi.waitFor(() =>
        expect(events.some((event) => event.event === "snapshot_wait")).toBe(
          true,
        ),
      );
      first.abort();
      if (cancelAll) second.abort();
      await oneRejected;
      await vi.advanceTimersByTimeAsync(2_000);
      await twoResult;
      expect(api.calls).toHaveLength(cancelAll ? 0 : 1);
    },
  );
  it("paces list pages and ordinary calls through the same scheduler and bypasses cache hits", async () => {
    const client = await open();
    vi.useFakeTimers({ now: 0 });
    const times: number[] = [];
    api.respond = (call): Response => {
      times.push(Date.now());
      return json(
        call.url.includes("pageToken=") &&
          !call.url.includes("pageToken=second")
          ? { tag: [{ name: "first" }], nextPageToken: "second" }
          : { tag: [{ name: "second" }] },
      );
    };
    const pending = Promise.all([
      client.callTool({
        name: "gtm_tag",
        arguments: { ...args, action: "list" },
      }),
      client.callTool({
        name: "gtm_tag",
        arguments: { ...args, action: "get", tagId: "4" },
      }),
    ]);
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(300);
    expect((await pending).every((result) => !result.isError)).toBe(true);
    expect(times.map((at) => at - times[0])).toEqual([0, 100, 200]);
    await client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "list" },
    });
    expect(api.calls).toHaveLength(3);
  });

  it("retries an explicit 403 rate limit with backoff and records each actual attempt", async () => {
    const events: GtmUsageEvent[] = [];
    const client = await open(events);
    vi.useFakeTimers({ now: 0 });
    const times: number[] = [];
    api.respond = (): Response => {
      times.push(Date.now());
      return times.length === 1
        ? json({ error: { errors: [{ reason: "rateLimitExceeded" }] } }, 403)
        : json({ name: "ok" });
    };
    const pending = client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "get", tagId: "4" },
    });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(2_000);
    expect((await pending).isError).not.toBe(true);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1_000);
    expect(
      events
        .filter((event) => event.event === "google_attempt")
        .map((event) => event.status),
    ).toEqual([403, 200]);
    expect(events.filter((event) => event.event === "retry_wait")).toHaveLength(
      1,
    );
  });

  it.each([
    { message: "Queries per day exhausted", status: 429 },
    { message: "Permission denied", status: 403 },
  ])("does not retry $message", async ({ message, status }) => {
    const client = await open();
    api.respond = (): Response => json({ error: { message } }, status);
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: { ...args, action: "get", tagId: "4" },
    });
    expect(result.isError).toBe(true);
    expect(api.calls).toHaveLength(1);
  });

  it.each(["create", "update", "remove"])(
    "does not replay %s after an uncertain network failure",
    async (action) => {
      const client = await open();
      api.respond = (): Response => {
        throw new TypeError("Connection lost after write committed");
      };
      const result = await client.callTool({
        name: "gtm_tag",
        arguments: {
          ...args,
          action,
          tagId: "4",
          fingerprint: "fingerprint",
          createOrUpdateConfig: { name: "test", type: "html" },
        },
      });
      expect(result.isError).toBe(true);
      expect(api.calls).toHaveLength(1);
    },
  );
});
