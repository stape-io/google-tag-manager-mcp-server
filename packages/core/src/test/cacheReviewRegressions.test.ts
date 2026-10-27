import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ListSnapshotCache,
  type GtmSnapshotRequest,
  type GtmSnapshotResult,
} from "../utils/listSnapshotCache.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import { createHarness, type McpHarness } from "./mcpHarness.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";

const api = useGoogleApiStub();
const path = "accounts/1/containers/2/workspaces/3/tags";
const request: GtmSnapshotRequest = {
  path,
  token: "review-token",
  namespace: "",
  fresh: false,
  call: { tool: "gtm_tag", action: "list", callId: "first" },
};
const harnesses: McpHarness[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

describe("cache review regressions", () => {
  it("does not invalidate a fresh snapshot when a completed lease's start arrives late", async () => {
    const cache = new ListSnapshotCache();
    await cache.endMutation("delayed-start");
    expect((await cache.read(request)).cache).toBe("miss");
    await cache.beginMutation("delayed-start");
    await cache.endMutation("delayed-start");
    expect((await cache.read(request)).cache).toBe("hit");
    expect(api.calls).toHaveLength(1);
  });
  it("bounds scheduled shared producers independently of subscriber budgets", async () => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let shared!: () => void;
    const joined = new Promise<void>((resolve) => {
      shared = resolve;
    });
    api.respond = (): Promise<Response> => {
      entered();
      return new Promise((resolve) =>
        setTimeout(
          () => resolve(json({ nextPageToken: String(api.calls.length) })),
          1000,
        ),
      );
    };
    const cache = new ListSnapshotCache({
      scheduler: new LocalGtmRequestScheduler({ intervalMs: 1 }),
      observer: (event): void => {
        if (event.event === "snapshot_wait") shared();
      },
    });
    const first = expect(
      cache.read({ ...request, deadline: 5_000 }),
    ).rejects.toMatchObject({ reason: "deadline" });
    await started;
    const second = expect(
      cache.read({
        ...request,
        deadline: 400_000,
        call: { ...request.call, callId: "longer" },
      }),
    ).rejects.toMatchObject({ reason: "deadline" });
    await joined;
    await vi.advanceTimersByTimeAsync(300_000);
    await Promise.all([first, second]);
    expect(api.calls).toHaveLength(300);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each([0, -1])(
    "keeps exact UTF-8 array byte accounting at the budget boundary (%s)",
    async (offset) => {
      const tag = [
        { name: "é" },
        {
          name: "🦄",
          parameter: [{ key: "x", type: "template", value: "🙂" }],
        },
      ];
      const bytes = new TextEncoder().encode(JSON.stringify(tag)).byteLength;
      api.respond = (): Response => json({ tag });
      const cache = new ListSnapshotCache({ maxBytes: bytes + offset });
      await cache.read(request);
      expect((await cache.read(request)).cache).toBe(
        offset === 0 ? "hit" : "miss",
      );
      expect(api.calls).toHaveLength(offset === 0 ? 1 : 2);
    },
  );
  it.each([false, true])(
    "a new reader never joins a cancelled fill (scheduling=%s)",
    async (scheduled) => {
      // Cover runtimes where digest returns an already fulfilled promise: the
      // new lookup can run before the aborted producer's finally callback.
      vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
      let release!: (response: Response) => void;
      api.respond = (): Response | Promise<Response> =>
        api.calls.length === 1
          ? new Promise((resolve) => {
              release = resolve;
            })
          : json({ tag: [{ name: "fresh" }] });
      const cache = new ListSnapshotCache({
        scheduler: scheduled
          ? new LocalGtmRequestScheduler({ intervalMs: 1 })
          : undefined,
      });
      const controller = new AbortController();
      const first = cache.read({ ...request, signal: controller.signal });
      const cancelled = expect(first).rejects.toBeDefined();
      await vi.waitFor(() => expect(api.calls).toHaveLength(1));
      controller.abort();
      const next = cache.read({
        ...request,
        call: { ...request.call, callId: "next" },
      });
      try {
        await cancelled;
        const result = await next;
        expect(result.cache).toBe("miss");
        expect(result.items[0].name).toBe("fresh");
        expect((await cache.read(request)).cache).toBe("hit");
        expect(api.calls).toHaveLength(2);
      } finally {
        release(json({ tag: [{ name: "old" }] }));
      }
    },
  );

  it("does not fetch more pages after cancellation with scheduling disabled", async () => {
    let release!: (response: Response) => void;
    api.respond = (): Promise<Response> =>
      new Promise((resolve) => {
        release = resolve;
      });
    const cache = new ListSnapshotCache();
    const controller = new AbortController();
    const cancelled = expect(
      cache.read({ ...request, signal: controller.signal }),
    ).rejects.toBeDefined();
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    controller.abort();
    await cancelled;
    release(json({ tag: [], nextPageToken: "second" }));
    // Let the already-started fetch unwind; no subsequent page may start.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(api.calls).toHaveLength(1);
  });

  it("expires each reader separately while allowing the shared scan to finish", async () => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let shared!: () => void;
    const joined = new Promise<void>((resolve) => {
      shared = resolve;
    });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = (): Promise<Response> => {
      entered();
      return new Promise((resolve) =>
        setTimeout(() => resolve(json({ tag: [{ name: "ok" }] })), 200),
      );
    };
    const cache = new ListSnapshotCache({
      scheduler: new LocalGtmRequestScheduler({ intervalMs: 1 }),
      observer: (event): void => {
        if (event.event === "snapshot_wait") shared();
      },
    });
    const first = expect(
      cache.read({ ...request, deadline: 100 }),
    ).rejects.toMatchObject({ reason: "deadline" });
    await started;
    const second = cache.read({
      ...request,
      deadline: 1_000,
      call: { ...request.call, callId: "late" },
    });
    await joined;
    await vi.advanceTimersByTimeAsync(300);
    await first;
    expect((await second).items[0].name).toBe("ok");
    expect(api.calls).toHaveLength(1);
  });

  it.each(["request", "response", "legacy"])(
    "releases a mutation lease after a delayed %s",
    async (kind) => {
      const cache = new ListSnapshotCache();
      const backend = {
        read: (input: GtmSnapshotRequest): Promise<GtmSnapshotResult> =>
          cache.read(input),
        beginMutation: async (id?: string): Promise<string> => {
          if (kind === "request")
            await new Promise((resolve) => setTimeout(resolve, 1_100));
          const actual = await cache.beginMutation(
            kind === "legacy" ? undefined : id,
          );
          if (kind !== "request")
            await new Promise((resolve) => setTimeout(resolve, 1_100));
          return actual;
        },
        endMutation: (id: string): Promise<void> => cache.endMutation(id),
        clear: (): Promise<void> => cache.clear(),
      };
      const harness = await createHarness({
        runtime: createGtmRuntime({ backend }),
      });
      harnesses.push(harness);
      vi.useFakeTimers();
      const pending = harness.client.callTool({
        name: "gtm_tag",
        arguments: {
          action: "remove",
          accountId: "1",
          containerId: "2",
          workspaceId: "3",
          tagId: "4",
        },
      });
      await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
      await vi.advanceTimersByTimeAsync(1_050);
      expect((await pending).isError).not.toBe(true);
      if (kind !== "legacy")
        expect((await cache.read(request)).cache).toBe("miss");
      await vi.advanceTimersByTimeAsync(100);
      const after = await cache.read(request);
      expect(after.cache).not.toBe("bypass");
      expect((await cache.read(request)).cache).toBe("hit");
    },
  );

  it.each([false, true])(
    "keeps a lease active when its late reply arrives during a write (legacy=%s)",
    async (legacy) => {
      const cache = new ListSnapshotCache();
      let started!: () => void;
      const beginning = new Promise<void>((resolve) => {
        started = resolve;
      });
      let release!: (response: Response) => void;
      api.respond = (call): Response | Promise<Response> =>
        call.method === "DELETE"
          ? new Promise((resolve) => {
              release = resolve;
            })
          : json({ tag: [] });
      const runtime = createGtmRuntime({
        backend: {
          read: (input) => cache.read(input),
          beginMutation: async (id): Promise<string> => {
            const actual = await cache.beginMutation(legacy ? undefined : id);
            started();
            await new Promise((resolve) => setTimeout(resolve, 1_100));
            return actual;
          },
          endMutation: (id) => cache.endMutation(id),
          clear: () => cache.clear(),
        },
      });
      const harness = await createHarness({ runtime });
      harnesses.push(harness);
      vi.useFakeTimers();
      const pending = harness.client.callTool({
        name: "gtm_tag",
        arguments: {
          action: "remove",
          accountId: "1",
          containerId: "2",
          workspaceId: "3",
          tagId: "4",
        },
      });
      await beginning;
      await vi.advanceTimersByTimeAsync(1_200);
      expect((await cache.read(request)).cache).toBe("bypass");
      release(json({}));
      expect((await pending).isError).not.toBe(true);
      expect((await cache.read(request)).cache).toBe("miss");
      expect((await cache.read(request)).cache).toBe("hit");
    },
  );

  it("does not expose cached entities through full snapshots or pages", async () => {
    api.respond = (): Response => json({ tag: [{ name: "original" }] });
    const cache = new ListSnapshotCache();
    const first = await cache.read(request);
    first.items[0].name = "changed";
    first.items.length = 0;
    const page = await cache.readPage({
      ...request,
      page: 1,
      itemsPerPage: 20,
    });
    expect(page.data[0].name).toBe("original");
    page.data[0].name = "changed again";
    expect((await cache.read(request)).items[0].name).toBe("original");
    expect(api.calls).toHaveLength(1);
  });
});
