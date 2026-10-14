import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer as McpServerV2 } from "@modelcontextprotocol/server";
import { registerGtmTools } from "google-tag-manager-mcp-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMcpApiHandler } from "../mcpHandler";
import { removeMCPServerData } from "../tools/removeMCPServerData";
import {
  CUTOVER_AT,
  HOST_NOTICE,
  hostNoticeInstructions,
  MOVED_NOTICE,
  withHostNotice,
} from "../utils/hostNotice";

// See mcpMethods.test.ts: the real entrypoint minus what Node cannot load.
vi.mock("agents/mcp", () => ({
  McpAgent: class {
    static serveSSE() {
      return { fetch: () => new Response() };
    }
  },
}));
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));

const { default: worker, flagOldHost } = await import("../index");

const PROPS = {
  userId: "user-1",
  name: "Test User",
  email: "test@example.com",
  accessToken: "test-access-token",
  expiresAt: Date.now() + 3_600_000,
  clientId: "client-1",
};

const ENV = { OAUTH_KV: { get: async () => null } } as unknown as Env;

const ctx = (props?: Record<string, unknown>): ExecutionContext =>
  ({
    waitUntil: () => {},
    passThroughOnException: () => {},
    props,
  }) as unknown as ExecutionContext;

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "host-notice-test", version: "0" },
  },
};

const CALL_AUTH_STATUS = {
  jsonrpc: "2.0",
  id: 7,
  method: "tools/call",
  params: { name: "gtm_auth_status", arguments: {} },
};

const request = (origin: string, body?: unknown, method = "POST"): Request =>
  new Request(`${origin}/mcp`, {
    method,
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      origin: "https://client.example",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// `props` stands in for what `flagOldHost` + OAuthProvider put on `ctx.props`.
async function mcp(
  body: unknown,
  props: Record<string, unknown>,
): Promise<{ instructions?: string; content: unknown[] }> {
  const fetchHandler = createMcpApiHandler(ENV).fetch;
  const response = await fetchHandler(
    request("https://gtm-mcp.stape.ai", body) as never,
    ENV,
    ctx(props),
  );
  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    : text;

  return JSON.parse(payload).result;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // gtm_auth_status asks Google's tokeninfo; a 400 makes it answer offline.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 400 })),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("flagOldHost", () => {
  it.each([
    ["https://gtm-mcp.stape.ai", { ...PROPS, oldHost: true }],
    ["https://gtm-mcp.stape.io", PROPS],
  ])("%s", async (origin, expected) => {
    const seen = vi.fn(() => new Response());
    const context = ctx({ ...PROPS });

    await flagOldHost({ fetch: seen }).fetch(
      request(origin, {}) as never,
      ENV,
      context,
    );

    expect(context.props).toEqual(expected);
    expect(seen).toHaveBeenCalledOnce();
  });
});

describe("/mcp before the cutover", () => {
  it("adds instructions to initialize only for old-host props", async () => {
    expect(
      (await mcp(INITIALIZE, { ...PROPS, oldHost: true })).instructions,
    ).toBe(hostNoticeInstructions());
    expect((await mcp(INITIALIZE, PROPS)).instructions).toBeUndefined();
  });

  it("appends the notice to tool results only for old-host props", async () => {
    const old = await mcp(CALL_AUTH_STATUS, { ...PROPS, oldHost: true });
    const current = await mcp(CALL_AUTH_STATUS, PROPS);

    expect(old.content).toEqual([
      ...current.content,
      { type: "text", text: HOST_NOTICE },
    ]);
    expect(current.content).toHaveLength(1);
  });
});

it("carries the notice on the v1 /sse server, as init() builds it for the old host", async () => {
  const server = new McpServer(
    { name: "google-tag-manager-mcp-server", version: "0.0.0-test" },
    { instructions: hostNoticeInstructions() },
  );
  const target = withHostNotice(server as unknown as McpServerV2);

  registerGtmTools(target, { auth: { getAccessToken: async () => "t" } });
  removeMCPServerData(target, {
    props: { ...PROPS, oldHost: true },
    oauth: {} as OAuthHelpers,
  });

  const client = new Client({ name: "host-notice-test", version: "0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  try {
    expect(client.getInstructions()).toBe(hostNoticeInstructions());

    const result = await client.callTool({
      name: "gtm_auth_status",
      arguments: {},
    });

    expect((result.content as unknown[]).at(-1)).toEqual({
      type: "text",
      text: HOST_NOTICE,
    });

    // A session open across the cutover switches on its next call.
    vi.useFakeTimers({ now: CUTOVER_AT, toFake: ["Date"] });

    const moved = await client.callTool({
      name: "gtm_auth_status",
      arguments: {},
    });

    expect(moved.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
  } finally {
    await client.close();
    await server.close();
  }
});

describe("old host after the cutover", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: CUTOVER_AT, toFake: ["Date"] });
  });

  it("still connects, with the moved notice as instructions", async () => {
    expect(
      (await mcp(INITIALIZE, { ...PROPS, oldHost: true })).instructions,
    ).toContain(MOVED_NOTICE);
  });

  it("returns only the moved notice from tools, without calling Google", async () => {
    const result = await mcp(CALL_AUTH_STATUS, { ...PROPS, oldHost: true });

    expect(result).not.toHaveProperty("isError");
    expect(result.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("leaves the new host alone", async () => {
    const result = await mcp(CALL_AUTH_STATUS, PROPS);

    expect(result.content).toHaveLength(1);
    expect(JSON.stringify(result.content)).not.toContain("Notice from Stape");
  });

  it("keeps OAuth in front of /mcp, so connectors can still sign in", async () => {
    const response = await worker.fetch(
      request("https://gtm-mcp.stape.ai", CALL_AUTH_STATUS) as never,
      ENV,
      ctx(),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("still runs tools on the old host the moment before the cutover", async () => {
    vi.setSystemTime(CUTOVER_AT - 1);

    const result = await mcp(CALL_AUTH_STATUS, { ...PROPS, oldHost: true });

    expect(fetch).toHaveBeenCalledOnce();
    expect(result.content.at(-1)).toEqual({ type: "text", text: HOST_NOTICE });
  });
});
