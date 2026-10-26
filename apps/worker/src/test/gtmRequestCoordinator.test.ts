import { afterEach, describe, expect, it, vi } from "vitest";
import { GtmRequestCoordinator } from "../GtmRequestCoordinator";
import { createHostedGtmScheduler } from "../createHostedGtmScheduler";

function station(overrides: Partial<Env> = {}): {
  state: DurableObjectState;
  env: Env;
  stored: Map<string, number>;
} {
  const stored = new Map<string, number>();
  let previous = Promise.resolve();
  const storage = {
    get: async (key: string): Promise<number | undefined> => stored.get(key),
    put: async (key: string, value: number): Promise<void> => {
      stored.set(key, value);
    },
    transaction: <T>(action: (storage: unknown) => Promise<T>): Promise<T> => {
      const result = previous.then(() => action(storage));
      previous = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  };
  return {
    state: { storage } as unknown as DurableObjectState,
    env: {
      GTM_REQUEST_INTERVAL_MS: "100",
      GTM_REQUEST_MAX_PENDING: "3",
      ...overrides,
    } as Env,
    stored,
  };
}
function reserve(
  object: GtmRequestCoordinator,
  deadline = 1_000,
): Promise<Response> {
  return object.fetch(
    new Request("https://coordinator.internal/acquire", {
      method: "POST",
      body: JSON.stringify({ deadline }),
    }),
  );
}
afterEach(() => vi.useRealTimers());

describe("hosted project coordinator", () => {
  it("reserves ahead of delivery latency without widening permit validity", async () => {
    vi.useFakeTimers({ now: 0 });
    const { state, env } = station();
    const coordinator = new GtmRequestCoordinator(state, env);
    const requests: { deadline: number; leadMs?: number }[] = [];
    const scheduler = createHostedGtmScheduler({
      ...env,
      GTM_REQUEST_SCHEDULER_ENABLED: "true",
      GTM_QUOTA_PROJECT_ID: "project",
      GTM_REQUEST_COORDINATOR: {
        idFromName: (name: string): string => name,
        get: (): unknown => ({
          fetch: async (
            input: string,
            init: RequestInit,
          ): Promise<Response> => {
            requests.push(JSON.parse(String(init.body)));
            const response = await coordinator.fetch(new Request(input, init));
            const permit = (await response.clone().json()) as {
              at: number;
              expiresAt: number;
            };
            if (response.ok) expect(permit.expiresAt - permit.at).toBe(100);
            await new Promise((resolve) => setTimeout(resolve, 200));
            return response;
          },
        }),
      },
    } as unknown as Env)!;
    const pending = scheduler.acquire({ deadline: 5_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    await pending;
    expect(requests).toHaveLength(2);
    expect(requests[1].leadMs).toBeGreaterThanOrEqual(200);
  });

  it("bounds renewal attempts if delivery keeps missing its permits", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const fetch = vi.fn(async (): Promise<Response> =>
      Response.json({ at: 0, expiresAt: 100 }),
    );
    const scheduler = createHostedGtmScheduler({
      GTM_REQUEST_SCHEDULER_ENABLED: "true",
      GTM_QUOTA_PROJECT_ID: "project",
      GTM_REQUEST_COORDINATOR: {
        idFromName: (name: string): string => name,
        get: (): unknown => ({ fetch }),
      },
    } as unknown as Env)!;
    const pending = expect(
      scheduler.acquire({ deadline: 5_000 }),
    ).rejects.toThrow("delivery is too slow");
    await vi.advanceTimersByTimeAsync(5);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("requeues a permit delivered after its expiry instead of releasing a burst", async () => {
    vi.useFakeTimers({ now: 1_000 });
    let requests = 0;
    const scheduler = createHostedGtmScheduler({
      GTM_REQUEST_SCHEDULER_ENABLED: "true",
      GTM_QUOTA_PROJECT_ID: "project-1",
      GTM_REQUEST_COORDINATOR: {
        idFromName: (name: string): string => name,
        get: (): unknown => ({
          fetch: async (): Promise<Response> =>
            Response.json(
              ++requests === 1
                ? { at: 0, expiresAt: 100 }
                : { at: 1_000, expiresAt: 1_100 },
            ),
        }),
      },
    } as unknown as Env)!;
    const pending = scheduler.acquire({ deadline: 2_000 });
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(requests).toBe(2);
  });
  it("allocates concurrent callers distinct FIFO reservations and preserves timing after recreation", async () => {
    vi.useFakeTimers({ now: 0 });
    const { state, env, stored } = station();
    const object = new GtmRequestCoordinator(state, env);
    const results = await Promise.all([
      reserve(object),
      reserve(object),
      reserve(object),
    ]);
    expect(await Promise.all(results.map((result) => result.json()))).toEqual([
      { at: 0, expiresAt: 100 },
      { at: 100, expiresAt: 200 },
      { at: 200, expiresAt: 300 },
    ]);
    await vi.advanceTimersByTimeAsync(100);
    const restarted = new GtmRequestCoordinator(state, env);
    expect(await (await reserve(restarted)).json()).toEqual({
      at: 300,
      expiresAt: 400,
    });
    expect([...stored.keys()]).toEqual(["nextAt"]);
  });

  it("rejects saturation and impossible deadlines without reserving more work", async () => {
    vi.useFakeTimers({ now: 0 });
    const { state, env, stored } = station({ GTM_REQUEST_MAX_PENDING: "1" });
    const object = new GtmRequestCoordinator(state, env);
    await reserve(object);
    expect(await (await reserve(object, 50)).json()).toEqual({
      error: "deadline",
    });
    expect(await (await reserve(object)).json()).toEqual({ error: "full" });
    expect(stored.get("nextAt")).toBe(100);
  });

  it("uses the project key for different runtime instances and never sends credentials to the coordinator", async () => {
    vi.useFakeTimers({ now: 0 });
    const { state, env } = station();
    const object = new GtmRequestCoordinator(state, env);
    const names: string[] = [];
    const bodies: string[] = [];
    const hosted = {
      ...env,
      GTM_REQUEST_SCHEDULER_ENABLED: "true",
      GTM_QUOTA_PROJECT_ID: "project-1",
      GTM_REQUEST_COORDINATOR: {
        idFromName: (name: string): string => {
          names.push(name);
          return name;
        },
        get: (): unknown => ({
          fetch: (input: string, init: RequestInit): Promise<Response> => {
            bodies.push(String(init.body));
            return object.fetch(new Request(input, init));
          },
        }),
      },
    } as unknown as Env;
    const first = createHostedGtmScheduler(hosted)!;
    const second = createHostedGtmScheduler(hosted)!;
    const pending = Promise.all([
      first.acquire({ deadline: 1_000 }),
      second.acquire({ deadline: 1_000 }),
    ]);
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    expect(names).toEqual(["project-1", "project-1"]);
    expect(bodies.map((body) => Object.keys(JSON.parse(body)))).toEqual([
      ["deadline"],
      ["deadline"],
    ]);
  });

  it("requires explicit project configuration when scheduling is enabled", () => {
    expect(createHostedGtmScheduler({} as Env)).toBeUndefined();
    expect(() =>
      createHostedGtmScheduler({
        GTM_REQUEST_SCHEDULER_ENABLED: "true",
      } as Env),
    ).toThrow("GTM_QUOTA_PROJECT_ID");
  });
});
