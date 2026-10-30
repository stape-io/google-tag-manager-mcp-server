import { afterEach, expect, it, vi } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/server";
import {
  createGtmRuntime,
  type GtmCallOptions,
} from "../utils/createGtmRuntime.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import {
  ListSnapshotCache,
  type GtmSnapshotRequest,
} from "../utils/listSnapshotCache.js";
import { getTagManagerClient } from "../utils/getTagManagerClient.js";
import { createErrorResponse } from "../utils/createErrorResponse.js";
import { createHarness, type McpHarness } from "./mcpHarness.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";
import type { GtmUsageEvent } from "../utils/gtmTelemetry.js";
const api = useGoogleApiStub();
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

it.each([false, true])(
  "a 16-page MCP list with extended client timeout=%s",
  async (extended) => {
    const runtime = createGtmRuntime({
      scheduler: new LocalGtmRequestScheduler(),
    });
    const harness = await createHarness({ runtime });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = (call): Response => {
      entered();
      const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
      return json({
        tag: [{ name: String(page) }],
        ...(page < 15 ? { nextPageToken: String(page + 1) } : {}),
      });
    };
    const args = {
      name: "gtm_tag",
      arguments: {
        action: "list",
        accountId: "1",
        containerId: "2",
        workspaceId: "3",
      },
    };
    const pending = harness.client
      .callTool(args, extended ? { timeout: 310_000 } : undefined)
      .catch((error) => error);
    await started;
    await vi.advanceTimersByTimeAsync(extended ? 62_000 : 60_000);
    const result = await pending;
    if (extended) {
      expect(result.isError).not.toBe(true);
      expect(JSON.parse(result.content[0].text).data).toHaveLength(16);
      await harness.client.callTool(args);
      expect(api.calls).toHaveLength(16);
    } else {
      expect(result.message).toMatch(/timed out/i);
      expect(api.calls).toHaveLength(15);
      // Cancellation reaches the sole producer; it must not fetch page 16 later.
      await vi.advanceTimersByTimeAsync(5000);
      expect(api.calls).toHaveLength(15);
    }
  },
);

it.each([
  ["export", undefined, false],
  ["export", "list", true],
  ["list", "single", false],
] as const)(
  "extraTools action %s with kind=%s gets the explicit budget",
  async (action, operationKind, succeeds) => {
    const harness = await createHarness({
      tools: [],
      runtime: createGtmRuntime({ scheduler: new LocalGtmRequestScheduler() }),
      extraTools: [
        (server, { auth, runtime }): void => {
          server.registerTool(
            "custom_export",
            {},
            async (): Promise<CallToolResult> => {
              try {
                const options: GtmCallOptions = { operationKind };
                const invocation = runtime!.startCall(
                  auth,
                  "custom_export",
                  action,
                  undefined,
                  options,
                );
                const client = await getTagManagerClient(auth, invocation);
                for (let i = 0; i < 8; i++)
                  await client.accounts.containers.workspaces.tags.get({
                    path: `${path}/${i}`,
                  });
                return { content: [{ type: "text", text: "exported" }] };
              } catch (error) {
                return createErrorResponse("Export failed", error);
              }
            },
          );
        },
      ],
    });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = (): Response => {
      entered();
      return json({});
    };
    const pending = harness.client.callTool({
      name: "custom_export",
      arguments: {},
    });
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    const result = await pending;
    expect(Boolean(result.isError)).toBe(!succeeds);
    expect(api.calls).toHaveLength(succeeds ? 8 : 7);
  },
);

it.each(["original", "replacement"])(
  "reuses whichever automatic replacement family member completes first: %s",
  async (winner) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    const events: GtmUsageEvent[] = [];
    let entered!: () => void;
    const releases: ((response: Response) => void)[] = [];
    api.respond = (): Promise<Response> =>
      new Promise((resolve) => {
        releases.push(resolve);
        entered();
      });
    const cache = new ListSnapshotCache({
      observer: (event): void => {
        events.push(event);
      },
    });
    let started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = cache.read(request);
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const replacement = cache.read(request);
    await started;
    const winnerIndex = winner === "original" ? 0 : 1;
    releases[winnerIndex](json({ tag: [{ name: winner }] }));
    const results = await Promise.all([original, replacement]);
    expect(results.map((result) => result.items[0].name)).toEqual([
      winner,
      winner,
    ]);
    // An already-running losing HTTP call may finish; its next page must not run.
    releases[1 - winnerIndex](
      json({ tag: [{ name: "loser" }], nextPageToken: "unused" }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toHaveLength(2);
    expect((await cache.read(request)).items[0].name).toBe(winner);
    expect(events.some((event) => event.event === "queue_cancelled")).toBe(
      false,
    );
  },
);

it.each(["fresh", "mutation", "clear"])(
  "does not reuse old results across a %s barrier",
  async (barrier) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const releases: ((response: Response) => void)[] = [];
    api.respond = (): Promise<Response> =>
      new Promise((resolve) => {
        releases.push(resolve);
        entered();
      });
    const cache = new ListSnapshotCache();
    let started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = cache.read(request);
    await started;
    if (barrier === "mutation") {
      const id = await cache.beginMutation();
      await cache.endMutation(id);
    }
    if (barrier === "clear") await cache.clear();
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let settled = false;
    const next = cache
      .read({ ...request, fresh: barrier === "fresh" })
      .then((value) => {
        settled = true;
        return value;
      });
    await started;
    releases[0](json({ tag: [{ name: "old" }] }));
    expect((await original).items[0].name).toBe("old");
    expect(settled).toBe(false);
    releases[1](json({ tag: [{ name: "new" }] }));
    expect((await next).items[0].name).toBe("new");
    expect((await cache.read(request)).items[0].name).toBe("new");
  },
);

it("reuses a nearly finished scheduled scan and does not count its replacement as user cancellation", async () => {
  vi.useFakeTimers({ now: 0 });
  vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const events: GtmUsageEvent[] = [];
  api.respond = async (call): Promise<Response> => {
    entered();
    const page = Number(new URL(call.url).searchParams.get("pageToken") || 0);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    return json({
      tag: [{ name: String(page) }],
      ...(page < 27 ? { nextPageToken: String(page + 1) } : {}),
    });
  };
  let admissions = 0;
  const cache = new ListSnapshotCache({
    scheduler: {
      acquire: async (): Promise<void> => {
        admissions++;
        if (Date.now() > 275_000) await new Promise(() => {});
      },
    },
    observer: (event): void => {
      events.push(event);
    },
  });
  const original = cache.read({ ...request, deadline: 300_000 });
  await started;
  await vi.advanceTimersByTimeAsync(275_001);
  const replacement = cache.read({ ...request, deadline: 575_001 });
  await vi.advanceTimersByTimeAsync(5000);
  expect((await original).items).toHaveLength(28);
  const reused = await replacement;
  expect(reused.items).toHaveLength(28);
  expect(reused.cache).toBe("coalesced");
  expect(admissions).toBe(29);
  expect(api.calls).toHaveLength(28);
  expect((await cache.read(request)).cache).toBe("hit");
  expect(events.some((event) => event.event === "queue_cancelled")).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["error", "cancel"])(
  "an original scan's %s does not poison its automatic replacement",
  async (mode) => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    let entered!: () => void;
    const releases: ((response: Response) => void)[] = [];
    api.respond = (): Promise<Response> =>
      new Promise((resolve) => {
        releases.push(resolve);
        entered();
      });
    const cache = new ListSnapshotCache();
    const controller = new AbortController();
    let started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = cache
      .read({ ...request, signal: controller.signal })
      .catch((error) => error);
    await started;
    await vi.advanceTimersByTimeAsync(30_000);
    started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const replacement = cache.read(request);
    await started;
    if (mode === "error")
      releases[0](json({ error: { message: "denied" } }, 403));
    else controller.abort();
    expect(await original).toBeInstanceOf(Error);
    releases[1](json({ tag: [{ name: "replacement" }] }));
    expect((await replacement).items[0].name).toBe("replacement");
    expect((await cache.read(request)).cache).toBe("hit");
  },
);
