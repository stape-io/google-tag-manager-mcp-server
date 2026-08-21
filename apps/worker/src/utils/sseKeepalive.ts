// An idle connection is dropped in front of the Worker after ~4.5 minutes.
const KEEPALIVE_INTERVAL_MS = 25_000;

const KEEPALIVE_FRAME = ": keepalive\n\n";

/**
 * `agents` heartbeats only the per-request POST stream, so the long-lived GET
 * stream a client listens on would otherwise sit silent until it is dropped.
 */
export function withSseKeepalive(response: Response): Response {
  const body = response.body;
  const isEventStream = response.headers
    .get("content-type")
    ?.includes("text/event-stream");

  if (!body || !isEventStream) {
    return response;
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Upstream may split one event across chunks; a frame injected mid-event
  // corrupts it.
  let atFrameBoundary = true;

  const timer = setInterval(() => {
    if (!atFrameBoundary) {
      return;
    }

    writer.write(encoder.encode(KEEPALIVE_FRAME)).catch(() => {
      clearInterval(timer);
    });
  }, KEEPALIVE_INTERVAL_MS);

  void (async (): Promise<void> => {
    const reader = body.getReader();

    try {
      for (;;) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        atFrameBoundary = false;
        await writer.write(value);
        atFrameBoundary =
          value.length >= 2 &&
          value[value.length - 1] === 10 &&
          value[value.length - 2] === 10;
      }
    } catch {
      // Upstream aborted.
    } finally {
      clearInterval(timer);
      await writer.close().catch(() => {});
    }
  })();

  return new Response(readable, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
