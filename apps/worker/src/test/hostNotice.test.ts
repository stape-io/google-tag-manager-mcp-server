import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer as McpServerV1 } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpServer } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUTOVER_AT,
  HOST_NOTICE,
  MOVED_NOTICE,
  SHUTDOWN_NOTICE,
  withHostNotice,
} from "../utils/hostNotice";

// See mcpMethods.test.ts: the real entrypoint minus what Node cannot load.
// The `McpAgent` stand-in is an empty base, so `init()` runs for real.
vi.mock("agents/mcp", () => ({
  McpAgent: class {
    static serveSSE(): { fetch: () => Response } {
      return { fetch: (): Response => new Response() };
    }
  },
}));
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }));

const { default: worker, GoogleTagManagerMCPServer } = await import("../index");

// Literal, so a clock bug in hostNoticeInstructions() can't hide behind itself.
const BEFORE_INSTRUCTIONS = `Tell the user this once per conversation: ${HOST_NOTICE}`;
const AFTER_INSTRUCTIONS = `Tell the user this before anything else: ${SHUTDOWN_NOTICE}`;

const REDIRECT_URI = "http://127.0.0.1:4305/oauth/callback";
// Public clients must use PKCE.
const CODE_VERIFIER = "host-notice-test-code-verifier-0123456789abcdef";
const CODE_CHALLENGE = btoa(
  String.fromCharCode(
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(CODE_VERIFIER),
      ),
    ),
  ),
)
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

/** Enough of KV for OAuthProvider: JSON reads, writes, deletes, prefix lists. */
function memoryKv(): KVNamespace {
  const store = new Map<string, string>();

  return {
    get: async (key: string, options?: string | { type?: string }) => {
      const value = store.get(key);
      const type = typeof options === "string" ? options : options?.type;

      if (value === undefined) {
        return null;
      }

      return type === "json" ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async ({ prefix = "" }: { prefix?: string } = {}) => ({
      keys: [...store.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .map((name) => ({ name })),
      list_complete: true,
    }),
  } as unknown as KVNamespace;
}

// The two deployments, told apart only by the var wrangler.jsonc sets.
const oldDeployment = (): Env =>
  ({
    OAUTH_KV: memoryKv(),
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    SHOW_HOST_NOTICE: "true",
  }) as unknown as Env;

const newDeployment = (): Env =>
  ({ ...oldDeployment(), SHOW_HOST_NOTICE: "false" }) as unknown as Env;

/** Google, as far as sign-in, refresh, tokeninfo and revoke need it. */
const google = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input);

  if (url.includes("userinfo")) {
    return Response.json({ id: "user-1", name: "Test User", email: "t@e.st" });
  }

  if (url.includes("tokeninfo")) {
    // gtm_auth_status answers offline on a 400.
    return new Response("{}", { status: 400 });
  }

  if (url.includes("revoke")) {
    return new Response(null, { status: 200 });
  }

  return Response.json({
    access_token: "google-access",
    refresh_token: "google-refresh",
    expires_in: 3599,
  });
});

const googleCalls = (): string[] =>
  google.mock.calls.map(([input]) =>
    String(input instanceof Request ? input.url : input),
  );

async function send(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;

  const response = await worker.fetch(
    new Request(`https://gtm-mcp.stape.ai${path}`, init) as never,
    env,
    ctx,
  );

  await Promise.all(pending);

  return response;
}

type Tokens = {
  clientId: string;
  access_token: string;
  refresh_token: string;
};

/** The whole sign-in, through the real OAuthProvider and /callback. */
async function signIn(env: Env): Promise<Tokens> {
  const registered = await send(env, "/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      client_name: "host-notice-test",
    }),
  });
  const { client_id: clientId } = (await registered.json()) as {
    client_id: string;
  };

  const state = btoa(
    JSON.stringify({
      responseType: "code",
      clientId,
      redirectUri: REDIRECT_URI,
      scope: [],
      state: "s",
      codeChallenge: CODE_CHALLENGE,
      codeChallengeMethod: "S256",
    }),
  );
  const callback = await send(env, `/callback?code=google-code&state=${state}`);
  const code = new URL(callback.headers.get("location") ?? "").searchParams.get(
    "code",
  );

  const tokens = await send(env, "/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code ?? "",
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: CODE_VERIFIER,
    }),
  });

  expect(tokens.status).toBe(200);

  return { clientId, ...((await tokens.json()) as Omit<Tokens, "clientId">) };
}

async function refresh(env: Env, tokens: Tokens): Promise<Response> {
  return send(env, "/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: tokens.clientId,
    }),
  });
}

type McpResult = {
  instructions?: string;
  isError?: boolean;
  content: { type: string; text: string }[];
};

type McpReply = { status: number; result?: McpResult };

async function mcp(
  env: Env,
  accessToken: string,
  method: string,
  params: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<McpReply> {
  const response = await send(env, "/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (response.status !== 200) {
    return { status: response.status };
  }

  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("")
    : text;

  return { status: 200, result: JSON.parse(payload).result };
}

const initialize = (env: Env, accessToken: string): Promise<McpReply> =>
  mcp(env, accessToken, "initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "host-notice-test", version: "0" },
  });

// The 2026-07-28 era opens with this instead of initialize.
const discover = (env: Env, accessToken: string): Promise<McpReply> =>
  mcp(
    env,
    accessToken,
    "server/discover",
    {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {
          name: "host-notice-test",
          version: "0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
    { "mcp-protocol-version": "2026-07-28", "mcp-method": "server/discover" },
  );

const callTool = (
  env: Env,
  accessToken: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<McpReply> =>
  mcp(env, accessToken, "tools/call", { name, arguments: args });

/** The `/sse` server, built by the real `init()` and served over SDK v1. */
async function connectSse(env: Env): Promise<Client> {
  const agent = new (
    GoogleTagManagerMCPServer as unknown as new () => {
      props: unknown;
      env: Env;
      server: McpServerV1;
      init(): Promise<void>;
    }
  )();
  agent.props = {
    userId: "user-1",
    name: "Test User",
    email: "t@e.st",
    accessToken: "google-access",
    refreshToken: "google-refresh",
    // Unix seconds, like a real grant; valid on every clock pinned here.
    expiresAt: CUTOVER_AT / 1000 + 86_400,
    clientId: "client-1",
  };
  agent.env = env;
  await agent.init();

  const client = new Client({ name: "host-notice-test", version: "0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    agent.server.connect(serverTransport),
  ]);

  return client;
}

const lastText = (content: unknown): unknown => (content as unknown[]).at(-1);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  google.mockClear();
  vi.stubGlobal("fetch", google);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("before the cutover", () => {
  // Pinned: on the real clock these would start failing on December 1, 2026.
  beforeEach(() => {
    vi.useFakeTimers({ now: CUTOVER_AT - 3_600_000, toFake: ["Date"] });
  });

  it("adds instructions and appends the notice on the .ai deployment", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    expect((await initialize(env, access_token)).result?.instructions).toBe(
      BEFORE_INSTRUCTIONS,
    );
    expect((await discover(env, access_token)).result?.instructions).toBe(
      BEFORE_INSTRUCTIONS,
    );

    const { result } = await callTool(env, access_token, "gtm_auth_status");

    expect(result?.content).toHaveLength(2);
    expect(lastText(result?.content)).toEqual({
      type: "text",
      text: HOST_NOTICE,
    });
    expect(googleCalls()).toContain("https://oauth2.googleapis.com/tokeninfo");
  });

  it("leaves the .io deployment alone", async () => {
    const env = newDeployment();
    const { access_token } = await signIn(env);

    expect(
      (await initialize(env, access_token)).result?.instructions,
    ).toBeUndefined();
    expect(
      (await discover(env, access_token)).result?.instructions,
    ).toBeUndefined();

    const { result } = await callTool(env, access_token, "gtm_auth_status");

    expect(result?.content).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Notice from Stape");
  });

  // Documented gap: the SDK rejects these before the wrapper runs.
  it("sends invalid-argument errors without the notice", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    const { result } = await callTool(env, access_token, "gtm_account", {});

    expect(result?.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Input validation error");
    expect(JSON.stringify(result)).not.toContain("Notice from Stape");
  });

  it("appends the notice to sign-out", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    const { result } = await callTool(env, access_token, "gtm_remove_session");

    expect(result?.content[0].text).toMatch(
      /^Signed out of the GTM MCP server/,
    );
    expect(lastText(result?.content)).toEqual({
      type: "text",
      text: HOST_NOTICE,
    });
  });

  it("still refreshes Google on token refresh", async () => {
    const env = oldDeployment();
    const tokens = await signIn(env);

    // Google's token (3599 s) is inside the refresh margin.
    vi.setSystemTime(CUTOVER_AT - 3_600_000 + 3_000_000);
    google.mockClear();

    expect((await refresh(env, tokens)).status).toBe(200);
    expect(googleCalls()).toEqual(["https://oauth2.googleapis.com/token"]);
  });
});

describe("after the cutover", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: CUTOVER_AT, toFake: ["Date"] });
  });

  it("still signs in and connects, with the moved notice as instructions", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    expect((await initialize(env, access_token)).result?.instructions).toBe(
      AFTER_INSTRUCTIONS,
    );
  });

  it("returns only the moved notice from tools, without calling Google", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);
    google.mockClear();

    const { result } = await callTool(env, access_token, "gtm_auth_status");

    expect(result).not.toHaveProperty("isError");
    expect(result?.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
    expect(google).not.toHaveBeenCalled();
  });

  it("still lists every tool, without input schemas", async () => {
    const listed = async (env: Env): Promise<McpTool[]> => {
      const { access_token } = await signIn(env);
      const { result } = await mcp(env, access_token, "tools/list", {});

      return (result as unknown as { tools: McpTool[] }).tools;
    };
    type McpTool = { name: string; inputSchema: unknown };

    const old = await listed(oldDeployment());
    const current = await listed(newDeployment());

    expect(old.map((tool) => tool.name)).toEqual(
      current.map((tool) => tool.name),
    );
    for (const tool of old) {
      expect(tool.inputSchema).toEqual({ type: "object", properties: {} });
    }
  });

  it("returns the moved notice for arguments the schema would reject", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    const { result } = await callTool(env, access_token, "gtm_account", {});

    expect(result).not.toHaveProperty("isError");
    expect(result?.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
  });

  it("keeps sign-out working, with the shutdown notice appended", async () => {
    const env = oldDeployment();
    const { access_token } = await signIn(env);

    const { result } = await callTool(env, access_token, "gtm_remove_session");

    // Not the usual "sign in again" text, which would point back here.
    expect(result?.content).toEqual([
      { type: "text", text: "Signed out of gtm-mcp.stape.ai." },
      { type: "text", text: SHUTDOWN_NOTICE },
    ]);
    expect(googleCalls()).toContain("https://oauth2.googleapis.com/revoke");
    expect((await callTool(env, access_token, "gtm_auth_status")).status).toBe(
      401,
    );
  });

  it("leaves the .io deployment alone", async () => {
    const env = newDeployment();
    const { access_token } = await signIn(env);

    const { result } = await callTool(env, access_token, "gtm_account", {});

    expect(result?.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("Input validation error");
    expect(JSON.stringify(result)).not.toContain("Notice from Stape");
  });

  it("keeps OAuth in front of /mcp, so connectors can still sign in", async () => {
    const response = await send(oldDeployment(), "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });
});

describe("approval dialog", () => {
  async function approvalPage(env: Env): Promise<string> {
    const registered = await send(env, "/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "none",
      }),
    });
    const { client_id: clientId } = (await registered.json()) as {
      client_id: string;
    };
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: CODE_CHALLENGE,
      code_challenge_method: "S256",
      state: "s",
    });

    return (await send(env, `/authorize?${query}`)).text();
  }

  it.each([
    ["the .ai deployment", oldDeployment, "STAPE.AI"],
    ["the .io deployment", newDeployment, "STAPE.IO"],
  ])("names %s", async (_label, deployment, name) => {
    const page = await approvalPage(deployment());

    expect(page).toContain(name);
    expect(page).not.toContain(name === "STAPE.AI" ? "STAPE.IO" : "STAPE.AI");
  });

  it("shows the notice on the .ai deployment only", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT - 3_600_000, toFake: ["Date"] });
    expect(await approvalPage(oldDeployment())).toContain(
      "gtm-mcp.stape.ai stops working on December 1, 2026",
    );
    expect(await approvalPage(newDeployment())).not.toContain(
      "Notice from Stape",
    );

    vi.setSystemTime(CUTOVER_AT);
    expect(await approvalPage(oldDeployment())).toContain(
      "gtm-mcp.stape.ai was shut down on December 1, 2026",
    );
  });
});

describe("token refresh across the cutover", () => {
  it("keeps the .ai grant alive without asking Google", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT - 60_000, toFake: ["Date"] });
    const env = oldDeployment();
    const tokens = await signIn(env);

    // Both the MCP and the Google access tokens have expired by now.
    vi.setSystemTime(CUTOVER_AT + 7_200_000);
    google.mockClear();

    const refreshed = await refresh(env, tokens);

    expect(refreshed.status).toBe(200);
    expect(google).not.toHaveBeenCalled();

    const { access_token } = (await refreshed.json()) as Tokens;
    const { result } = await callTool(env, access_token, "gtm_auth_status");

    expect(result?.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
  });

  it("still refreshes Google on the .io deployment", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT - 60_000, toFake: ["Date"] });
    const env = newDeployment();
    const tokens = await signIn(env);

    vi.setSystemTime(CUTOVER_AT + 7_200_000);
    google.mockClear();

    expect((await refresh(env, tokens)).status).toBe(200);
    expect(googleCalls()).toEqual(["https://oauth2.googleapis.com/token"]);
  });
});

describe("/sse, through the real init()", () => {
  it("carries the notice, and switches to the moved notice at the cutover", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT - 3_600_000, toFake: ["Date"] });
    const client = await connectSse(oldDeployment());

    try {
      expect(client.getInstructions()).toBe(BEFORE_INSTRUCTIONS);

      const result = await client.callTool({
        name: "gtm_auth_status",
        arguments: {},
      });

      expect(lastText(result.content)).toEqual({
        type: "text",
        text: HOST_NOTICE,
      });

      // A session open across the cutover switches on its next call.
      vi.setSystemTime(CUTOVER_AT);

      const moved = await client.callTool({
        name: "gtm_auth_status",
        arguments: {},
      });

      expect(moved.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);

      // Documented gap: this server was built before the cutover, so the SDK
      // still validates and rejects bad arguments without the notice.
      const invalid = await client.callTool({
        name: "gtm_account",
        arguments: {},
      });

      expect(invalid.isError).toBe(true);
      expect(JSON.stringify(invalid)).not.toContain("Notice from Stape");
    } finally {
      await client.close();
    }
  });

  it("drops input schemas when built after the cutover", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT, toFake: ["Date"] });
    const client = await connectSse(oldDeployment());

    try {
      expect(client.getInstructions()).toBe(AFTER_INSTRUCTIONS);

      const { tools } = await client.listTools();

      expect(tools.length).toBeGreaterThan(0);
      for (const tool of tools) {
        expect(tool.inputSchema).toEqual({ type: "object", properties: {} });
      }

      const result = await client.callTool({
        name: "gtm_account",
        arguments: {},
      });

      expect(result).not.toHaveProperty("isError");
      expect(result.content).toEqual([{ type: "text", text: MOVED_NOTICE }]);
    } finally {
      await client.close();
    }
  });

  it("leaves the .io deployment alone", async () => {
    vi.useFakeTimers({ now: CUTOVER_AT - 3_600_000, toFake: ["Date"] });
    const client = await connectSse(newDeployment());

    try {
      expect(client.getInstructions()).toBeUndefined();

      const result = await client.callTool({
        name: "gtm_auth_status",
        arguments: {},
      });

      expect(JSON.stringify(result)).not.toContain("Notice from Stape");
    } finally {
      await client.close();
    }
  });
});

// The notices spell the date and host out; this fails if they drift.
it("states the same cutover as CUTOVER_AT, and the new URL", () => {
  expect(new Date(CUTOVER_AT).toISOString()).toBe("2026-12-01T00:00:00.000Z");
  for (const notice of [HOST_NOTICE, SHUTDOWN_NOTICE, MOVED_NOTICE]) {
    expect(notice).toContain("December 1, 2026 at 00:00 UTC");
    expect(notice).toContain("https://gtm-mcp.stape.io/mcp");
  }
});

describe("withHostNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: CUTOVER_AT - 3_600_000, toFake: ["Date"] });
  });

  it("appends the notice to a result that has no content", async () => {
    let handler = async (): Promise<unknown> => undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof handler) => {
        handler = cb;
      },
    } as unknown as McpServer;

    withHostNotice(server).registerTool("t", {}, async () => ({}) as never);

    expect(await handler()).toEqual({
      content: [{ type: "text", text: HOST_NOTICE }],
    });
  });

  it("drops input and output schemas when registered after the cutover", () => {
    vi.setSystemTime(CUTOVER_AT);
    let config: Record<string, unknown> = {};
    const server = {
      registerTool: (_name: string, registered: typeof config) => {
        config = registered;
      },
    } as unknown as McpServer;

    withHostNotice(server).registerTool(
      "t",
      { description: "d", inputSchema: {}, outputSchema: {} } as never,
      async () => ({ content: [] }),
    );

    expect(config).toEqual({
      description: "d",
      inputSchema: undefined,
      outputSchema: undefined,
    });
  });

  it("never runs a handler that was registered without its schema", async () => {
    vi.setSystemTime(CUTOVER_AT);
    let handler = async (): Promise<unknown> => undefined;
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof handler) => {
        handler = cb;
      },
    } as unknown as McpServer;
    const real = vi.fn(async () => ({ content: [] }));

    withHostNotice(server).registerTool("t", {}, real);
    // A clock that steps back across the cutover.
    vi.setSystemTime(CUTOVER_AT - 1);

    expect(await handler()).toEqual({
      content: [{ type: "text", text: MOVED_NOTICE }],
    });
    expect(real).not.toHaveBeenCalled();
  });

  it("leaves everything other than tools on the server itself", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const prompt = async (): Promise<{ messages: [] }> => ({ messages: [] });

    withHostNotice(server).registerPrompt("a", {}, prompt);

    // Throws "A request handler for prompts/list already exists" if the first
    // call left its state on a wrapper instead.
    expect(() => server.registerPrompt("b", {}, prompt)).not.toThrow();
  });
});
