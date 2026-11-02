import type { GtmUsageObserver } from "google-tag-manager-mcp-core";

export function createWorkerUsageObserver(env: Env): GtmUsageObserver {
  return (event) => {
    env.GTM_USAGE?.writeDataPoint({
      indexes: [event.tool],
      blobs: [
        event.event,
        event.tool,
        event.action,
        event.cache ?? "",
        event.quota ?? "none",
        event.callId,
      ],
      doubles: [
        1,
        event.status ?? 0,
        event.durationMs ?? 0,
        event.attempt ?? 0,
      ],
    });
  };
}
