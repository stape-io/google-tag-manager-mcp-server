// Local-only entry point. Never imported by the deployed Worker.
import { createMcpApiHandler } from "../../apps/worker/src/mcpHandler";
import { createHostedGtmRuntime } from "../../apps/worker/src/createHostedGtmRuntime";
export { GtmReadCache } from "../../apps/worker/src/GtmReadCache";
export { GtmRequestCoordinator } from "../../apps/worker/src/GtmRequestCoordinator";

const realFetch = globalThis.fetch.bind(globalThis);
let googleOrigin = "";
// Force googleapis' HTTP layer through our loopback fake, and fail closed if
// a new outbound dependency appears. This station needs no real credentials.
Object.assign(globalThis, {
  window: {
    fetch: (input: string | URL | Request, init?: RequestInit) => {
      const source = new URL(input instanceof Request ? input.url : input);
      if (source.hostname !== "tagmanager.googleapis.com")
        throw new Error(
          "Local station blocked outbound host: " + source.hostname,
        );
      const target = new URL(source.pathname + source.search, googleOrigin);
      return realFetch(target, init);
    },
  },
});

export default {
  async fetch(
    request: Request<unknown, IncomingRequestCfProperties>,
    env: Env & { LOCAL_GOOGLE_ORIGIN: string },
    ctx: ExecutionContext,
  ) {
    if (new URL(request.url).pathname === "/health") return new Response("ok");
    googleOrigin = env.LOCAL_GOOGLE_ORIGIN;
    const userId = request.headers.get("x-station-user") ?? "user-1";
    const props = {
      userId,
      clientId: "local-station",
      name: "Local station",
      email: "station@example.invalid",
      accessToken: "fake-token-" + userId,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    if (new URL(request.url).pathname === "/station/cancellation") {
      const coordinator = env.GTM_REQUEST_COORDINATOR!.get(
        env.GTM_REQUEST_COORDINATOR!.idFromName(env.GTM_QUOTA_PROJECT_ID!),
      );
      // Reserve future slots without waiting for them, keeping the scan
      // genuinely queued while the cancellation message crosses the DO hop.
      await Promise.all(
        Array.from({ length: 5 }, () =>
          coordinator.fetch("https://gtm-scheduler.internal/acquire", {
            method: "POST",
            body: JSON.stringify({ deadline: Date.now() + 5_000 }),
          }),
        ),
      );
      const controller = new AbortController();
      const runtime = createHostedGtmRuntime(env, props);
      const pending = runtime
        .startCall(
          { getAccessToken: async () => props.accessToken },
          "gtm_tag",
          "list",
          controller.signal,
        )
        .listSnapshot(
          "accounts/1/containers/2/workspaces/cancelled/tags",
          false,
        );
      const timer = setTimeout(() => controller.abort(), 20);
      try {
        await pending;
        return Response.json({ cancelled: false });
      } catch {
        return Response.json({ cancelled: true });
      } finally {
        clearTimeout(timer);
      }
    }
    const delayMs = Number(
      request.headers.get("x-station-coordinator-delay") ?? 0,
    );
    let handlerEnv = env;
    if (delayMs > 0 && delayMs <= 500 && env.GTM_REQUEST_COORDINATOR) {
      const namespace = env.GTM_REQUEST_COORDINATOR;
      handlerEnv = {
        ...env,
        GTM_REQUEST_COORDINATOR: {
          idFromName: (name: string) => namespace.idFromName(name),
          get: (id: DurableObjectId) => ({
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
              const response = await namespace.get(id).fetch(input, init);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              return response;
            },
          }),
        } as unknown as DurableObjectNamespace,
      };
    }
    return createMcpApiHandler(handlerEnv).fetch!(
      request,
      handlerEnv,
      Object.assign(ctx, { props }),
    );
  },
};
