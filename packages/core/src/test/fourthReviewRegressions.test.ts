import { afterEach, expect, it, vi } from "vitest";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import {
  ListSnapshotCache,
  type GtmSnapshotRequest,
} from "../utils/listSnapshotCache.js";
import {
  GTM_LIST_DEADLINE_MS,
  GTM_REQUEST_DEADLINE_MS,
} from "../utils/gtmScheduledAdapter.js";
import { createHarness, type McpHarness } from "./mcpHarness.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";
const api = useGoogleApiStub();
const auth = { getAccessToken: async (): Promise<string> => "review-token" };
const path = "accounts/1/containers/2/workspaces/3/tags";
const request: GtmSnapshotRequest = {
  path,
  token: "fake",
  namespace: "",
  fresh: false,
  call: { tool: "gtm_tag", action: "list", callId: "first" },
};
const harnesses: McpHarness[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

it.each([true, false])(
  "completes eight pages at default pacing (cache=%s)",
  async (enabled) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const times: number[] = [];
    api.respond = (call): Response => {
      times.push(Date.now());
      entered();
      const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
      return json({
        tag: [{ name: String(page) }],
        ...(page < 7 ? { nextPageToken: String(page + 1) } : {}),
      });
    };
    const runtime = createGtmRuntime({
      enabled,
      scheduler: new LocalGtmRequestScheduler(),
    });
    const list = runtime
      .startCall(auth, "gtm_tag", "list")
      .listPage(path, false, 1, 20);
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    expect((await list).data).toHaveLength(8);
    expect(times).toEqual([0, 4100, 8200, 12300, 16400, 20500, 24600, 28700]);
    if (enabled) {
      await runtime
        .startCall(auth, "gtm_tag", "list")
        .listPage(path, false, 1, 20);
      expect(api.calls).toHaveLength(8);
    }
  },
);

it.each(["gtm_folder", "gtm_version_header"])(
  "allows %s pagination beyond the ordinary call budget",
  async (name) => {
    const runtime = createGtmRuntime({
      scheduler: new LocalGtmRequestScheduler(),
    });
    const harness = await createHarness({ runtime });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = (call): Response => {
      entered();
      const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
      return json({
        [name === "gtm_folder" ? "folder" : "containerVersionHeader"]: [
          { name: String(page) },
        ],
        ...(page < 7 ? { nextPageToken: String(page + 1) } : {}),
      });
    };
    const result = harness.client.callTool({
      name,
      arguments: {
        action: "list",
        accountId: "1",
        containerId: "2",
        workspaceId: "3",
        includeDeleted: false,
      },
    });
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    const reply = await result;
    expect(reply.isError).not.toBe(true);
    const body = JSON.parse((reply.content as { text: string }[])[0].text);
    expect(body.data).toHaveLength(8);
    expect(api.calls).toHaveLength(8);
  },
);

it.each([
  GTM_LIST_DEADLINE_MS - GTM_REQUEST_DEADLINE_MS,
  GTM_LIST_DEADLINE_MS - GTM_REQUEST_DEADLINE_MS + 1,
])(
  "checks remaining producer budget before joining at %s ms",
  async (joinAt) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = async (call): Promise<Response> => {
      const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
      entered();
      if (page === 0 && Date.now() > 0)
        return json({ tag: [{ name: "replacement" }] });
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return json({
        tag: [{ name: "original" }],
        ...(page < 27 ? { nextPageToken: String(page + 1) } : {}),
      });
    };
    const cache = new ListSnapshotCache({
      scheduler: new LocalGtmRequestScheduler({ intervalMs: 1 }),
    });
    const first = cache.read({ ...request, deadline: GTM_LIST_DEADLINE_MS });
    await started;
    await vi.advanceTimersByTimeAsync(joinAt);
    const second = cache.read({
      ...request,
      deadline: Date.now() + GTM_LIST_DEADLINE_MS,
      call: { ...request.call, callId: "second" },
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await second;
    const replaces = joinAt > GTM_LIST_DEADLINE_MS - GTM_REQUEST_DEADLINE_MS;
    expect(result.cache).toBe(replaces ? "miss" : "coalesced");
    expect(result.items).toHaveLength(replaces ? 1 : 28);
    // The first completed automatic family member now also serves older readers.
    expect((await first).items).toHaveLength(replaces ? 1 : 28);
    expect(api.calls).toHaveLength(replaces ? 29 : 28);
    expect((await cache.read(request)).items[0].name).toBe(
      replaces ? "replacement" : "original",
    );
  },
);
