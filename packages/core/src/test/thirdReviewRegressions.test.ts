import { afterEach, expect, it, vi } from "vitest";
import {
  ListSnapshotCache,
  LIST_SNAPSHOT_JOIN_WINDOW_MS,
  type GtmSnapshotRequest,
} from "../utils/listSnapshotCache.js";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import { getTagManagerClient } from "../utils/getTagManagerClient.js";
import type { GtmUsageEvent } from "../utils/gtmTelemetry.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";

const api = useGoogleApiStub();
const auth = { getAccessToken: async (): Promise<string> => "review-token" };
const path = "accounts/1/containers/2/workspaces/3/tags";
const request: GtmSnapshotRequest = {
  path,
  token: "review-token",
  namespace: "",
  fresh: false,
  call: { tool: "gtm_tag", action: "list", callId: "review" },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("lets later readers recover from a hung scan without timing out its existing reader", async () => {
  vi.useFakeTimers({ now: 0 });
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  api.respond = (): Promise<Response> | Response => {
    if (api.calls.length === 1) {
      entered();
      return new Promise(() => {});
    }
    return json({ tag: [{ name: "recovered" }] });
  };
  const cache = new ListSnapshotCache();
  const controller = new AbortController();
  let settled = false;
  const first = cache
    .read({ ...request, signal: controller.signal })
    .catch((error) => error)
    .finally(() => {
      settled = true;
    });
  await started;
  await vi.advanceTimersByTimeAsync(LIST_SNAPSHOT_JOIN_WINDOW_MS);
  expect((await cache.read(request)).items[0].name).toBe("recovered");
  expect(settled).toBe(false);
  expect(api.calls).toHaveLength(2);
  controller.abort();
  await first;
  expect((await cache.read(request)).cache).toBe("hit");
  expect(api.calls).toHaveLength(2);
});

it("keeps sharing a healthy scan that completes pages beyond 30 seconds", async () => {
  vi.useFakeTimers({ now: 0 });
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  api.respond = async (call): Promise<Response> => {
    entered();
    const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return json({
      tag: [{ name: String(page) }],
      ...(page < 3 ? { nextPageToken: String(page + 1) } : {}),
    });
  };
  const cache = new ListSnapshotCache();
  const first = cache.read(request);
  await started;
  await vi.advanceTimersByTimeAsync(30_000);
  const joined = cache.read(request);
  await vi.advanceTimersByTimeAsync(10_000);
  expect((await first).items).toHaveLength(4);
  expect((await joined).cache).toBe("coalesced");
  expect(api.calls).toHaveLength(4);
});

it.each(["before", "after"])(
  "an old scan completing %s a fresh replacement cannot remove or overwrite it",
  async (order) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    const releases: ((response: Response) => void)[] = [];
    let entered!: () => void;
    api.respond = (): Promise<Response> =>
      new Promise((resolve) => {
        releases.push(resolve);
        entered();
      });
    const cache = new ListSnapshotCache();
    let started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = cache.read(request);
    await started;
    await vi.advanceTimersByTimeAsync(LIST_SNAPSHOT_JOIN_WINDOW_MS - 1);
    const coalesced = cache.read(request);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.calls).toHaveLength(1);
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const replacement = cache.read({ ...request, fresh: true });
    await started;
    if (order === "before") {
      releases[0](json({ tag: [{ name: "old" }] }));
      expect((await first).items[0].name).toBe("old");
    }
    // If old cleanup deleted the replacement, this read would start a third scan.
    const joined = cache.read(request);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toHaveLength(2);
    releases[1](json({ tag: [{ name: "new" }] }));
    expect((await replacement).items[0].name).toBe("new");
    expect((await joined).cache).toBe("coalesced");
    if (order === "after") releases[0](json({ tag: [{ name: "old" }] }));
    expect((await first).items[0].name).toBe("old");
    expect((await coalesced).cache).toBe("coalesced");
    const cached = await cache.read(request);
    expect(cached.cache).toBe("hit");
    expect(cached.items[0].name).toBe("new");
    expect(api.calls).toHaveLength(2);
  },
);

it("paces supplied-cache pagination, retries and ordinary calls through the same scheduler", async () => {
  vi.useFakeTimers({ now: 0 });
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
  const scheduler = new LocalGtmRequestScheduler({ intervalMs: 100 });
  const acquire = vi.spyOn(scheduler, "acquire");
  const events: GtmUsageEvent[] = [];
  const observer = (event: GtmUsageEvent): void => {
    events.push(event);
  };
  const backend = new ListSnapshotCache({ scheduler, observer });
  const runtime = createGtmRuntime({ backend, scheduler, observer });
  const times: number[] = [];
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  api.respond = (): Response => {
    times.push(Date.now());
    entered();
    if (api.calls.length === 1)
      return json(
        {
          error: {
            message: "temporary quota",
            errors: [{ reason: "rateLimitExceeded" }],
          },
        },
        403,
      );
    if (api.calls.length === 2)
      return json({ tag: [{ name: "one" }], nextPageToken: "next" });
    if (api.calls.length === 3) return json({ tag: [{ name: "two" }] });
    return json({ name: "ordinary get" });
  };
  const list = runtime
    .startCall(auth, "gtm_tag", "list")
    .listPage(path, false, 1, 20);
  await started;
  await vi.advanceTimersByTimeAsync(5000);
  expect((await list).data.map((item) => item.name)).toEqual(["one", "two"]);
  const client = await getTagManagerClient(
    auth,
    runtime.startCall(auth, "gtm_tag", "get"),
  );
  const get = client.accounts.containers.workspaces.tags.get({
    path: `${path}/4`,
  });
  await vi.advanceTimersByTimeAsync(100);
  expect((await get).data.name).toBe("ordinary get");
  expect(acquire).toHaveBeenCalledTimes(4);
  expect(api.calls).toHaveLength(4);
  expect(
    times.slice(1).every((time, index) => time - times[index] >= 100),
  ).toBe(true);
  expect(events.filter((event) => event.event === "retry_wait")).toHaveLength(
    1,
  );
  await runtime.startCall(auth, "gtm_tag", "list").listPage(path, false, 1, 20);
  expect(acquire).toHaveBeenCalledTimes(4);
});
