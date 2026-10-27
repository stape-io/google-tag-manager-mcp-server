import { afterEach, describe, expect, it, vi } from "vitest";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import {
  ListSnapshotCache,
  type GtmSnapshotRequest,
} from "../utils/listSnapshotCache.js";
import {
  GtmSchedulingError,
  LocalGtmRequestScheduler,
} from "../utils/gtmRequestScheduler.js";
import { getTagManagerClient } from "../utils/getTagManagerClient.js";
import { gtmRetryConfig, type GtmUsageEvent } from "../utils/gtmTelemetry.js";
import { createHarness, type McpHarness } from "./mcpHarness.js";
import { json, useGoogleApiStub } from "./googleApiStub.js";

const api = useGoogleApiStub();
const auth = { getAccessToken: async (): Promise<string> => "review-token" };
const path = "accounts/1/containers/2/workspaces/3/tags";
const args = {
  action: "get",
  accountId: "1",
  containerId: "2",
  workspaceId: "3",
  tagId: "4",
};
const harnesses: McpHarness[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

describe("second review regressions", () => {
  it.each([
    [true, false, 26_000],
    [false, false, 26_000],
    [true, true, 31_000],
    [false, true, 31_000],
  ] as const)(
    "allows slow unscheduled lists (cache=%s, hosted backend=%s, delay=%s)",
    async (enabled, hosted, latency) => {
      vi.useFakeTimers({ now: 0 });
      vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      api.respond = (): Promise<Response> => {
        entered();
        return new Promise((resolve) =>
          setTimeout(
            () => resolve(json({ tag: [{ name: "slow list" }] })),
            latency,
          ),
        );
      };
      const runtime = createGtmRuntime({
        enabled,
        backend: hosted ? new ListSnapshotCache() : undefined,
      });
      const pending = runtime
        .startCall(auth, "gtm_tag", "list")
        .listPage(path, false, 1, 20);
      await started;
      await vi.advanceTimersByTimeAsync(latency);
      expect((await pending).data[0].name).toBe("slow list");
      if (enabled) {
        expect(
          (
            await runtime
              .startCall(auth, "gtm_tag", "list")
              .listPage(path, false, 1, 20)
          ).data[0].name,
        ).toBe("slow list");
      }
      expect(api.calls).toHaveLength(1);
    },
  );

  it.each([false, true])(
    "retains scheduled call deadlines (cache=%s)",
    async (enabled) => {
      vi.useFakeTimers({ now: 0 });
      vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      api.respond = (): Promise<Response> => {
        entered();
        return new Promise((resolve) =>
          setTimeout(() => resolve(json({ tag: [] })), 26_000),
        );
      };
      const runtime = createGtmRuntime({
        enabled,
        scheduler: new LocalGtmRequestScheduler({ intervalMs: 1 }),
      });
      const rejected = expect(
        runtime.startCall(auth, "gtm_tag", "list").listPage(path, false, 1, 20),
      ).rejects.toThrow("deadline");
      await started;
      await vi.advanceTimersByTimeAsync(26_000);
      await rejected;
      expect(api.calls).toHaveLength(1);
    },
  );

  it("records an expired lone reader as a timeout, not user cancellation", async () => {
    vi.useFakeTimers({ now: 0 });
    vi.spyOn(crypto.subtle, "digest").mockResolvedValue(new ArrayBuffer(32));
    const events: GtmUsageEvent[] = [];
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const cache = new ListSnapshotCache({
      scheduler: {
        acquire: async (): Promise<void> => {
          entered();
          return new Promise(() => {});
        },
      },
      observer: (event): void => {
        events.push(event);
      },
    });
    const request: GtmSnapshotRequest = {
      path,
      token: "fake",
      namespace: "",
      fresh: false,
      deadline: 100,
      call: { tool: "gtm_tag", action: "list", callId: "timeout" },
    };
    const pending = expect(cache.read(request)).rejects.toMatchObject({
      reason: "deadline",
    });
    await started;
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(events.some((event) => event.event === "queue_rejected")).toBe(true);
    expect(events.some((event) => event.event === "queue_cancelled")).toBe(
      false,
    );
    expect(api.calls).toHaveLength(0);
  });

  it("keeps network failure context when its retry exceeds the budget", async () => {
    const harness = await createHarness({
      runtime: createGtmRuntime({
        scheduler: { acquire: async (): Promise<void> => {} },
      }),
    });
    harnesses.push(harness);
    vi.useFakeTimers({ now: 0 });
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    api.respond = async (): Promise<Response> => {
      entered();
      await new Promise((resolve) => setTimeout(resolve, 24_500));
      throw new Error("upstream connection reset");
    };
    const pending = harness.client.callTool({
      name: "gtm_tag",
      arguments: args,
    });
    await started;
    await vi.advanceTimersByTimeAsync(24_500);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("deadline exceeded");
    expect(JSON.stringify(result.content)).toContain(
      "upstream connection reset",
    );
    expect(api.calls).toHaveLength(1);
  });

  it.each(["deadline", "unavailable"])(
    "keeps quota context after failed re-admission (%s)",
    async (failure) => {
      let permits = 0;
      const runtime = createGtmRuntime({
        scheduler: {
          acquire: async (): Promise<void> => {
            if (++permits === 2)
              throw failure === "deadline"
                ? new GtmSchedulingError("deadline")
                : new Error("Coordinator unavailable");
          },
        },
      });
      const harness = await createHarness({ runtime });
      harnesses.push(harness);
      vi.useFakeTimers({ now: 0 });
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      api.respond = (): Response => {
        entered();
        return json(
          {
            error: {
              message: "quota rejection evidence",
              errors: [{ reason: "rateLimitExceeded" }],
            },
          },
          403,
        );
      };
      const pending = harness.client.callTool({
        name: "gtm_tag",
        arguments: args,
      });
      await started;
      await vi.advanceTimersByTimeAsync(2_000);
      const result = await pending;
      expect(result.isError).toBe(true);
      const content = JSON.stringify(result.content);
      expect(content).toContain(
        failure === "deadline"
          ? "deadline exceeded"
          : "Coordinator unavailable",
      );
      expect(content).toContain("403");
      expect(content).toContain("quota rejection evidence");
      expect(api.calls).toHaveLength(1);
    },
  );

  it("keeps the retry guard effective for both public request overrides", async () => {
    const shouldRetry = vi.fn(gtmRetryConfig!.shouldRetry!);
    const retryConfig = { ...gtmRetryConfig, shouldRetry };
    api.respond = (): Response => json({ error: { message: "busy" } }, 503);
    const client = await getTagManagerClient(
      auth,
      createGtmRuntime().startCall(auth, "gtm_tag", "get"),
    );
    for (const options of [
      { retry: false, retryConfig },
      { retryConfig: { ...retryConfig, retry: 0 } },
    ])
      await expect(
        client.accounts.containers.workspaces.tags.get(
          { path: path + "/4" },
          options,
        ),
      ).rejects.toThrow("busy");
    expect(shouldRetry.mock.calls[0][0].config?.retry).toBe(false);
    expect(shouldRetry.mock.calls[1][0].config?.retryConfig?.retry).toBe(0);
    expect(api.calls).toHaveLength(2);
  });
});
