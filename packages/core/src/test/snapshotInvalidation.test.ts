import { afterEach, expect, it, vi } from "vitest";
import {
  ListSnapshotCache,
  type GtmSnapshotRequest,
} from "../utils/listSnapshotCache.js";
import { useGoogleApiStub } from "./googleApiStub.js";
const api = useGoogleApiStub();
const path = "accounts/1/containers/2/workspaces/3/tags";
const request = (client: string): GtmSnapshotRequest => ({
  path,
  token: `credential-${client}`,
  namespace: client,
  fresh: false,
  call: { tool: "gtm_tag", action: "list", callId: client },
});
afterEach(() => vi.useRealTimers());
it("invalidates every credential/client sharing a backend and bypasses reads during a write", async () => {
  const cache = new ListSnapshotCache();
  await cache.read(request("A"));
  await cache.read(request("B"));
  expect((await cache.read(request("B"))).cache).toBe("hit");
  const id = await cache.beginMutation();
  expect((await cache.read(request("B"))).cache).toBe("bypass");
  await cache.endMutation(id);
  expect((await cache.read(request("A"))).cache).toBe("miss");
  expect((await cache.read(request("B"))).cache).toBe("miss");
  expect(api.calls).toHaveLength(5);
});
it("recovers cache reuse after a lost mutation end's 120-second lease expires", async () => {
  vi.useFakeTimers({ now: 0 });
  const cache = new ListSnapshotCache();
  await cache.beginMutation("lost-end");
  expect((await cache.read(request("B"))).cache).toBe("bypass");
  await vi.advanceTimersByTimeAsync(119_999);
  expect((await cache.read(request("B"))).cache).toBe("bypass");
  await vi.advanceTimersByTimeAsync(1);
  expect((await cache.read(request("B"))).cache).toBe("miss");
  expect((await cache.read(request("B"))).cache).toBe("hit");
  expect(api.calls).toHaveLength(3);
});
