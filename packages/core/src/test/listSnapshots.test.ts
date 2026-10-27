import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarness } from "./mcpHarness.js";
import {
  json,
  TEST_WORKSPACE_PATH,
  useGoogleApiStub,
} from "./googleApiStub.js";

import { containerActions } from "../tools/containerActions.js";
import { tagActions } from "../tools/tagActions.js";
import { createGtmRuntime } from "../utils/createGtmRuntime.js";
import { LocalGtmRequestScheduler } from "../utils/gtmRequestScheduler.js";
import {
  ListSnapshotCache,
  LIST_SNAPSHOT_TTL_MS,
} from "../utils/listSnapshotCache.js";
import type { GtmUsageEvent } from "../utils/gtmTelemetry.js";

const api = useGoogleApiStub();
const listArgs = {
  action: "list",
  accountId: "1",
  containerId: "2",
  workspaceId: "3",
};
const harnesses: Awaited<ReturnType<typeof createHarness>>[] = [];
async function open(
  options: Parameters<typeof createHarness>[0] = {},
): Promise<Awaited<ReturnType<typeof createHarness>>["client"]> {
  const harness = await createHarness(options);
  harnesses.push(harness);
  return harness.client;
}
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
  vi.restoreAllMocks();
});

describe.each(["tag", "trigger", "variable"])(
  "%s list snapshots",
  (resource) => {
    it("fetches five Google pages once when reading ten MCP pages", async () => {
      api.respond = ({ url }): Response => {
        const page = Number(new URL(url).searchParams.get("pageToken") || 0);
        return json({
          [resource]: Array.from({ length: 40 }, (_, index) => ({
            name: `item-${page * 40 + index}`,
          })),
          nextPageToken: page < 4 ? String(page + 1) : undefined,
        });
      };
      const harness = await createHarness();
      try {
        for (let page = 1; page <= 10; page++) {
          const result = await harness.client.callTool({
            name: `gtm_${resource}`,
            arguments: {
              action: "list",
              accountId: "1",
              containerId: "2",
              workspaceId: "3",
              page,
            },
          });
          expect(result.isError).not.toBe(true);
          const payload = JSON.parse(
            (result.content as { text: string }[])[0].text,
          );
          expect(payload.data).toHaveLength(20);
          expect(payload.data[0].name).toBe(`item-${(page - 1) * 20}`);
          expect(payload.pagination.totalItems).toBe(200);
        }
        expect(api.calls).toHaveLength(5);
        expect(api.calls[0].url).toContain(TEST_WORKSPACE_PATH);
      } finally {
        await harness.close();
      }
    });
  },
);

describe("snapshot correctness", () => {
  it("expires snapshots without extending their lifetime on reads", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const client = await open();
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    now += LIST_SNAPSHOT_TTL_MS - 1;
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(1);
    now++;
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(2);
  });

  it("bypasses a snapshot with fresh and keeps resource get calls uncached", async () => {
    const client = await open();
    for (const fresh of [false, true, false])
      await client.callTool({
        name: "gtm_tag",
        arguments: { ...listArgs, fresh },
      });
    expect(api.calls).toHaveLength(2);
    for (let index = 0; index < 2; index++)
      await client.callTool({
        name: "gtm_tag",
        arguments: { ...listArgs, action: "get", tagId: "4" },
      });
    expect(api.calls).toHaveLength(4);
  });

  it("isolates credentials and resource paths even when the backend is shared", async () => {
    const runtime = createGtmRuntime();
    const a = await open({
      runtime,
      auth: { getAccessToken: async () => "token-a" },
    });
    const b = await open({
      runtime,
      auth: { getAccessToken: async () => "token-b" },
    });
    for (const client of [a, b, a, b])
      await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(2);
    await a.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, workspaceId: "other" },
    });
    await a.callTool({ name: "gtm_trigger", arguments: listArgs });
    expect(api.calls).toHaveLength(4);
  });

  it("checks authorization again before returning cached data", async () => {
    let authorized = true;
    const client = await open({
      auth: {
        getAccessToken: async () => {
          if (!authorized) throw new Error("Access token expired");
          return "token-a";
        },
      },
    });
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    authorized = false;
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: listArgs,
    });
    expect(result.isError).toBe(true);
    expect(api.calls).toHaveLength(1);
  });

  it("rotates the cache namespace when the credential changes", async () => {
    let token = "token-a";
    const client = await open({ auth: { getAccessToken: async () => token } });
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    token = "token-b";
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(2);
  });

  it("coalesces concurrent scans, including requests for different MCP pages", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.respond = async (): Promise<Response> => {
      await gate;
      return json({
        tag: Array.from({ length: 40 }, (_, index) => ({
          name: String(index),
        })),
      });
    };
    const events: GtmUsageEvent[] = [];
    const client = await open({
      runtime: createGtmRuntime({ observer: (event) => events.push(event) }),
    });
    const first = client.callTool({ name: "gtm_tag", arguments: listArgs });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    const second = client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, page: 2 },
    });
    await vi.waitFor(() =>
      expect(events.some((event) => event.event === "snapshot_wait")).toBe(
        true,
      ),
    );
    release();
    const results = await Promise.all([first, second]);
    expect(results.every((result) => !result.isError)).toBe(true);
    expect(api.calls).toHaveLength(1);
    expect(
      events.filter((event) => event.event === "google_attempt"),
    ).toHaveLength(1);
    expect(
      events
        .filter((event) => event.event === "snapshot")
        .map((event) => event.cache)
        .sort(),
    ).toEqual(["coalesced", "miss"]);
  });

  it.each([false, true])(
    "invalidates all resource snapshots around a mutation (failed=%s)",
    async (failed) => {
      api.respond = ({ method }): Response =>
        method === "DELETE" && failed
          ? json({ error: { message: "Rejected" } }, 400)
          : json({});
      const client = await open();
      for (const resource of ["tag", "trigger", "variable"])
        await client.callTool({ name: `gtm_${resource}`, arguments: listArgs });
      await client.callTool({
        name: "gtm_container",
        arguments: { action: "remove", accountId: "1", containerId: "2" },
      });
      for (const resource of ["tag", "trigger", "variable"])
        await client.callTool({ name: `gtm_${resource}`, arguments: listArgs });
      expect(api.calls.filter((call) => call.method === "GET")).toHaveLength(6);
    },
  );

  it.each(["2", "999"])(
    "returns an overlapping list without caching it after a mutation in container %s",
    async (containerId) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let first = true;
      api.respond = async ({ method }): Promise<Response> => {
        if (method === "GET" && first) {
          first = false;
          await gate;
          return json({ tag: [{ name: "old" }] });
        }
        return json({ tag: [{ name: "new" }] });
      };
      const client = await open();
      const pending = client.callTool({ name: "gtm_tag", arguments: listArgs });
      await vi.waitFor(() => expect(api.calls).toHaveLength(1));
      await client.callTool({
        name: "gtm_tag",
        arguments: { ...listArgs, containerId, action: "remove", tagId: "4" },
      });
      release();
      expect((await pending).isError).not.toBe(true);
      const result = await client.callTool({
        name: "gtm_tag",
        arguments: listArgs,
      });
      expect(JSON.stringify(result.content)).toContain("new");
      expect(api.calls).toHaveLength(3);
    },
  );

  it("discards partial scans and failed pending fetches", async () => {
    let fail = true;
    api.respond = ({ url }): Response => {
      if (!new URL(url).searchParams.get("pageToken"))
        return json({ tag: [{ name: "first" }], nextPageToken: "next" });
      return fail
        ? json({ error: { message: "Denied" } }, 403)
        : json({ tag: [{ name: "second" }] });
    };
    const client = await open();
    expect(
      (await client.callTool({ name: "gtm_tag", arguments: listArgs })).isError,
    ).toBe(true);
    fail = false;
    expect(
      (await client.callTool({ name: "gtm_tag", arguments: listArgs })).isError,
    ).not.toBe(true);
    expect(api.calls).toHaveLength(4);
  });

  it("classifies daily quota failures without retrying or caching them", async () => {
    const events: GtmUsageEvent[] = [];
    api.respond = (): Response =>
      json({ error: { message: "Quota exceeded for Queries per day" } }, 429);
    const client = await open({
      runtime: createGtmRuntime({ observer: (event) => events.push(event) }),
    });
    for (let index = 0; index < 2; index++)
      expect(
        (await client.callTool({ name: "gtm_tag", arguments: listArgs }))
          .isError,
      ).toBe(true);
    expect(api.calls).toHaveLength(2);
    expect(events.filter((event) => event.quota === "daily")).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("secret-test-token");
    expect(JSON.stringify(events)).not.toContain(TEST_WORKSPACE_PATH);
  });

  it("counts each SDK retry as a Google attempt and caches the eventual result", async () => {
    const events: GtmUsageEvent[] = [];
    let attempts = 0;
    api.respond = (): Response =>
      ++attempts === 1
        ? json({ error: { message: "Busy" } }, 503)
        : json({ tag: [] });
    const client = await open({
      runtime: createGtmRuntime({ observer: (event) => events.push(event) }),
    });
    expect(
      (await client.callTool({ name: "gtm_tag", arguments: listArgs })).isError,
    ).not.toBe(true);
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(2);
    expect(
      events
        .filter((event) => event.event === "google_attempt")
        .map((event) => [event.status, event.attempt]),
    ).toEqual([
      [503, 1],
      [200, 2],
    ]);
  });

  it("bounds retained snapshots by both entry count and bytes", async () => {
    for (const limits of [{ maxEntries: 1 }, { maxBytes: 1 }]) {
      const client = await open({
        runtime: createGtmRuntime({ backend: new ListSnapshotCache(limits) }),
      });
      const before = api.calls.length;
      for (const workspaceId of ["a", "b", "a"])
        await client.callTool({
          name: "gtm_tag",
          arguments: { ...listArgs, workspaceId },
        });
      expect(api.calls.length - before).toBe(3);
    }
  });

  it("telemetry and post-write invalidation failures do not turn a successful mutation into a retry", async () => {
    const backend = new ListSnapshotCache();
    vi.spyOn(backend, "endMutation").mockRejectedValue(
      new Error("Cache unavailable"),
    );
    const client = await open({
      runtime: createGtmRuntime({
        backend,
        observer: () => {
          throw new Error("Metrics unavailable");
        },
      }),
    });
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, action: "remove", tagId: "4" },
    });
    expect(result.isError).not.toBe(true);
    expect(api.calls).toHaveLength(1);
  });

  it("keeps lists that overlap a mutation working when snapshots are disabled", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    api.respond = async ({ method }): Promise<Response> => {
      if (method === "GET") await gate;
      return json({ tag: [{ name: "listed" }] });
    };
    const client = await open({
      runtime: createGtmRuntime({ enabled: false }),
    });
    const pending = client.callTool({ name: "gtm_tag", arguments: listArgs });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    await client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, action: "remove", tagId: "4" },
    });
    release();
    expect((await pending).isError).not.toBe(true);
  });

  it("disables snapshots even when a backend is supplied", async () => {
    const client = await open({
      runtime: createGtmRuntime({
        backend: new ListSnapshotCache(),
        enabled: false,
      }),
    });
    for (let index = 0; index < 2; index++)
      await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls).toHaveLength(2);
  });

  it("does not answer a fresh read from a scan that started before it", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let first = true;
    api.respond = async (): Promise<Response> => {
      if (first) {
        first = false;
        await gate;
        return json({ tag: [{ name: "old" }] });
      }
      return json({ tag: [{ name: "new" }] });
    };
    const client = await open();
    const pending = client.callTool({ name: "gtm_tag", arguments: listArgs });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    const fresh = await client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, fresh: true },
    });
    expect(JSON.stringify(fresh.content)).toContain("new");
    release();
    expect(JSON.stringify((await pending).content)).toContain("old");
    const cached = await client.callTool({
      name: "gtm_tag",
      arguments: listArgs,
    });
    expect(JSON.stringify(cached.content)).toContain("new");
    expect(api.calls).toHaveLength(2);
  });

  it("does not treat listing folder entities as a mutation", async () => {
    const client = await open();
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    await client.callTool({
      name: "gtm_folder",
      arguments: { ...listArgs, action: "entities", folderId: "5" },
    });
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls.map((call) => call.method)).toEqual(["GET", "POST"]);
  });

  it("shares one runtime between tools registered directly on a server", async () => {
    const client = await open({
      tools: [
        (server, { auth }): void => tagActions(server, { auth }),
        (server, { auth }): void => containerActions(server, { auth }),
      ],
    });
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    await client.callTool({
      name: "gtm_container",
      arguments: { action: "remove", accountId: "1", containerId: "2" },
    });
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("keeps a list that starts during a mutation working after the mutation ends", async () => {
    let releaseDelete!: () => void;
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    let releaseList!: () => void;
    const listGate = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    api.respond = async ({ method }): Promise<Response> => {
      await (method === "DELETE" ? deleteGate : listGate);
      return json({ tag: [{ name: "listed" }] });
    };
    const client = await open();
    const mutation = client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, action: "remove", tagId: "4" },
    });
    await vi.waitFor(() => expect(api.calls).toHaveLength(1));
    const pending = client.callTool({ name: "gtm_tag", arguments: listArgs });
    await vi.waitFor(() => expect(api.calls).toHaveLength(2));
    releaseDelete();
    await mutation;
    releaseList();
    const result = await pending;
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).toContain("listed");
    await client.callTool({ name: "gtm_tag", arguments: listArgs });
    expect(api.calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("records a fresh read as a snapshot bypass", async () => {
    const events: GtmUsageEvent[] = [];
    const client = await open({
      runtime: createGtmRuntime({ observer: (event) => events.push(event) }),
    });
    await client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, fresh: true },
    });
    expect(
      events
        .filter((event) => event.event === "snapshot")
        .map((event) => event.cache),
    ).toEqual(["bypass"]);
  });

  it.each(["tag", "trigger", "variable"])(
    "looks up credentials once per %s list, including cache hits",
    async (resource) => {
      const getAccessToken = vi.fn(async () => "token");
      const client = await open({ auth: { getAccessToken } });
      for (let index = 0; index < 2; index++)
        await client.callTool({ name: "gtm_" + resource, arguments: listArgs });
      expect(getAccessToken).toHaveBeenCalledTimes(2);
      expect(api.calls).toHaveLength(1);
    },
  );

  it("does not retry a daily quota failure on a resource get", async () => {
    api.respond = (): Response =>
      json({ error: { message: "Quota exceeded for Queries per day" } }, 429);
    const client = await open();
    expect(
      (
        await client.callTool({
          name: "gtm_tag",
          arguments: { ...listArgs, action: "get", tagId: "4" },
        })
      ).isError,
    ).toBe(true);
    expect(api.calls).toHaveLength(1);
  });

  it.each(["beginMutation", "endMutation"] as const)(
    "keeps writes working when %s rejects",
    async (method) => {
      const backend = new ListSnapshotCache();
      vi.spyOn(backend, method).mockRejectedValue(
        new Error("Cache unavailable"),
      );
      const client = await open({ runtime: createGtmRuntime({ backend }) });
      const result = await client.callTool({
        name: "gtm_tag",
        arguments: { ...listArgs, action: "remove", tagId: "4" },
      });
      expect(result.isError).not.toBe(true);
      expect(api.calls).toHaveLength(1);
    },
  );

  it.each(["beginMutation", "endMutation", "read"] as const)(
    "bounds a hanging cache %s call",
    async (method) => {
      const backend = new ListSnapshotCache();
      // This case exercises external backends that implement read() only.
      if (method === "read")
        Object.defineProperty(backend, "readPage", { value: undefined });
      const stuck = vi
        .spyOn(backend, method)
        .mockImplementation(() => new Promise<never>(() => {}));
      const client = await open({
        runtime: createGtmRuntime({
          backend,
          scheduler:
            method === "read" ? new LocalGtmRequestScheduler() : undefined,
        }),
      });
      vi.useFakeTimers();
      try {
        const done = vi.fn();
        const pending = client.callTool({
          name: "gtm_tag",
          arguments:
            method === "read"
              ? listArgs
              : { ...listArgs, action: "remove", tagId: "4" },
        });
        pending.then(done, () => {});
        await vi.waitFor(() => expect(stuck).toHaveBeenCalled());
        await vi.advanceTimersByTimeAsync(30_000);
        expect(done).toHaveBeenCalled();
        if (method === "read") {
          expect((await pending).isError).toBe(true);
          expect(api.calls).toHaveLength(0);
        } else {
          expect((await pending).isError).not.toBe(true);
          expect(api.calls).toHaveLength(1);
        }
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("does not start a second Google scan when a hosted cache read times out", async () => {
    let release!: (response: Response) => void;
    api.respond = (): Promise<Response> =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const backend = new ListSnapshotCache();
    const client = await open({
      runtime: createGtmRuntime({
        backend,
        scheduler: new LocalGtmRequestScheduler(),
      }),
    });
    vi.useFakeTimers();
    try {
      const pending = client.callTool({ name: "gtm_tag", arguments: listArgs });
      await vi.waitFor(() => expect(api.calls).toHaveLength(1));
      await vi.advanceTimersByTimeAsync(30_000);
      expect(api.calls).toHaveLength(1);
      expect((await pending).isError).toBe(true);
    } finally {
      release(json({ tag: [] }));
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
    }
  });

  it("paginates a custom backend that only implements full snapshot reads", async () => {
    api.respond = (): Response =>
      json({
        tag: Array.from({ length: 40 }, (_, index) => ({
          name: String(index),
        })),
      });
    const cache = new ListSnapshotCache();
    const client = await open({
      runtime: createGtmRuntime({
        backend: {
          read: (request) => cache.read(request),
          beginMutation: () => cache.beginMutation(),
          endMutation: (id) => cache.endMutation(id),
          clear: () => cache.clear(),
        },
      }),
    });
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: { ...listArgs, page: 2 },
    });
    const payload = JSON.parse((result.content as { text: string }[])[0].text);
    expect(payload.data).toHaveLength(20);
    expect(payload.data[0].name).toBe("20");
    expect(payload.pagination.totalItems).toBe(40);
  });

  it("preserves the SDK policy of not retrying a failed POST", async () => {
    api.respond = (): Response =>
      json({ error: { message: "Unavailable" } }, 503);
    const client = await open();
    const result = await client.callTool({
      name: "gtm_tag",
      arguments: {
        ...listArgs,
        action: "create",
        createOrUpdateConfig: { name: "test", type: "html" },
      },
    });
    expect(result.isError).toBe(true);
    expect(api.calls).toHaveLength(1);
  });
});
