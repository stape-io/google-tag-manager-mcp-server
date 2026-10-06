import { describe, expect, it } from "vitest";
import { createMcpApiHandler } from "../mcpHandler";

/**
 * The response-side era assertion for the Worker's `/mcp` route: everything is
 * read off the SERVER's answer, never off what the request claimed.
 *
 * What this DOES cover: the real handler `apps/worker/src/index.ts` mounts,
 * driven over real `Request`/`Response` objects - era negotiation, the
 * `ctx.props` -> `getMcpAuthContext()` plumbing the whole hybrid approach rests
 * on, the registered tool set, and the `ExportedHandler` shape `OAuthProvider`
 * demands.
 *
 * What this does NOT cover: a real Cloudflare runtime, `OAuthProvider`'s token
 * decryption, and `/sse`. Those stay on the live dev-deployment gate.
 */

const MODERN_PROTOCOL_VERSION = "2026-07-28";

const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": { name: "worker-test", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

const PROPS = {
  userId: "user-1",
  name: "Test User",
  email: "test@example.com",
  accessToken: "test-access-token",
  expiresAt: Date.now() + 3_600_000,
  clientId: "client-1",
};

const ENV = { WORKER_HOST: "https://gtm-mcp.example" } as unknown as Env;

function executionContext(props?: Record<string, unknown>): ExecutionContext {
  return {
    waitUntil: () => {},
    passThroughOnException: () => {},
    props,
  } as unknown as ExecutionContext;
}

async function post(
  body: {
    method: string;
    params?: Record<string, unknown>;
    [key: string]: unknown;
  },
  // `null` means "no props on the ExecutionContext"; `undefined` would silently
  // fall back to the default.
  props: Record<string, unknown> | null = PROPS,
): Promise<{ status: number; json: any }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };

  // The modern era requires the method to be restated in a header, so a proxy
  // can route without parsing the body. Legacy frames must NOT carry it.
  if (body.params?._meta) {
    headers["mcp-method"] = body.method;
  }

  const fetchHandler = createMcpApiHandler(ENV).fetch;
  const request = new Request("https://gtm-mcp.example/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof fetchHandler>[0];

  const response = await fetchHandler(
    request,
    ENV,
    executionContext(props ?? undefined),
  );

  const text = await response.text();

  // The modern path answers single exchanges as SSE unless told otherwise.
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    : text;

  return {
    status: response.status,
    json: payload ? JSON.parse(payload) : undefined,
  };
}

describe("/mcp handler", () => {
  it("answers server/discover and advertises protocol revision 2026-07-28", async () => {
    const { json } = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: MODERN_META },
    });

    // The era, read off the server's own answer. A bare v2 `McpServer` wired to
    // a transport by hand - or the old `McpAgent.serve("/mcp")` - answers
    // `server/discover` with -32601 and serves the 2025 era only.
    expect(json.error).toBeUndefined();
    expect(json.result?.supportedVersions).toContain(MODERN_PROTOCOL_VERSION);
    expect(
      json.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name,
    ).toBe("google-tag-manager-mcp-server");
  });

  it("still serves the 2025-era initialize handshake", async () => {
    const { json } = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "worker-test", version: "0" },
      },
    });

    expect(json.result?.protocolVersion).toBe("2024-11-05");
    expect(json.result?.serverInfo?.name).toBe("google-tag-manager-mcp-server");
  });

  it("serves the full tool set, including the worker-only session tool", async () => {
    const { json } = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: { _meta: MODERN_META },
    });

    const names: string[] = (json.result?.tools ?? []).map(
      (tool: { name: string }) => tool.name,
    );

    expect(names.length).toBeGreaterThanOrEqual(21);
    expect(names).toContain("gtm_account");
    expect(names).toContain("gtm_auth_status");
    expect(names).toContain("gtm_guide");
    expect(names).toContain("gtm_tag");
    expect(names).toContain("gtm_remove_session");
  });

  it("reads the grant from ctx.props via getMcpAuthContext", async () => {
    // No props on the ExecutionContext -> no AsyncLocalStorage store -> the
    // factory refuses to build a server. This is the plumbing the whole hybrid
    // approach depends on; if `.fetch(request, requestOptions)` were wired into
    // `apiHandlers` instead of the callable `(request, env, ctx)` form, `ctx`
    // would never reach the handler and every authenticated request would look
    // like this one.
    const withoutProps = await post(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: MODERN_META },
      },
      null,
    );

    expect(withoutProps.json.result).toBeUndefined();
    expect(withoutProps.json.error).toBeDefined();
  });

  it("is shaped the way OAuthProvider.validateHandler accepts", () => {
    // Verbatim from @cloudflare/workers-oauth-provider's validateHandler: a
    // bare `createMcpHandler(...)` callable is `typeof "function"` and would
    // throw a TypeError at OAuthProvider construction - i.e. a 500 on every
    // request to the Worker, `/sse` included.
    const handler: unknown = createMcpApiHandler(ENV);

    expect(typeof handler).toBe("object");
    expect(handler).not.toBeNull();
    expect(typeof (handler as { fetch: unknown }).fetch).toBe("function");
  });
});
