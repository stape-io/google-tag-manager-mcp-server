// Persist timing reservations only. Credentials and payloads stay in callers.
export class GtmRequestCoordinator {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    const body = (await request.json()) as { deadline?: unknown };
    const deadline = body.deadline;
    const now = Date.now();
    if (
      typeof deadline !== "number" ||
      !Number.isFinite(deadline) ||
      deadline > now + 60_000
    )
      return Response.json({ error: "invalid" }, { status: 400 });
    const interval = Number(this.env.GTM_REQUEST_INTERVAL_MS ?? 4_100);
    const maxPending = Number(this.env.GTM_REQUEST_MAX_PENDING ?? 25);
    if (
      !Number.isFinite(interval) ||
      interval < 1 ||
      interval > 60_000 ||
      !Number.isInteger(maxPending) ||
      maxPending < 1 ||
      maxPending > 1_000
    )
      return Response.json({ error: "configuration" }, { status: 500 });
    return this.state.storage.transaction(async (storage) => {
      const at = Math.max(
        Date.now(),
        (await storage.get<number>("nextAt")) ?? 0,
      );
      if (at >= deadline)
        return Response.json({ error: "deadline" }, { status: 429 });
      if (Math.ceil((at - Date.now()) / interval) >= maxPending)
        return Response.json({ error: "full" }, { status: 429 });
      await storage.put("nextAt", at + interval);
      return Response.json({ at, expiresAt: at + Math.min(interval, 1_000) });
    });
  }
}
