import { beforeEach, describe, expect, it, vi } from "vitest";

// The real entrypoint and the real OAuthProvider, minus the two imports Node
// cannot load: the Durable Object base class behind `/sse`, and
// `cloudflare:workers`, which OAuthProvider only uses for an `instanceof`.
vi.mock("agents/mcp", () => ({
  McpAgent: class {
    static serveSSE() {
      return { fetch: () => new Response() };
    }
  },
}));
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));

const { default: worker } = await import("../index");

// No token is ever stored, so any bearer token fails validation - which is
// what proves a 405 never consulted it.
const ENV = { OAUTH_KV: { get: async () => null } } as unknown as Env;

const CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

const WWW_AUTHENTICATE =
  'Bearer realm="OAuth", resource_metadata="https://gtm-mcp.stape.ai/.well-known/oauth-protected-resource/mcp"';

function send(method: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const request = new Request("https://gtm-mcp.stape.ai/mcp", {
    method,
    headers,
    body: method === "POST" ? "{}" : undefined,
  });

  return worker.fetch(request as never, ENV, CTX);
}

describe("/mcp methods", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  for (const method of ["GET", "DELETE"]) {
    it(`answers ${method} with 405 without a token`, async () => {
      const response = await send(method);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST, OPTIONS");
      expect(response.headers.has("www-authenticate")).toBe(false);
      expect(await response.json()).toEqual({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    it(`answers ${method} with 405 with a token`, async () => {
      const response = await send(method, "user:grant:secret");

      expect(response.status).toBe(405);
    });
  }

  it("still challenges a POST without a token", async () => {
    const response = await send("POST");

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(WWW_AUTHENTICATE);
  });

  it("still rejects a POST with an invalid token", async () => {
    const response = await send("POST", "user:grant:secret");

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'error="invalid_token"',
    );
  });
});
