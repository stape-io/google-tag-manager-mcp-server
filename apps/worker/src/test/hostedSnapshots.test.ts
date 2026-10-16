import { afterEach, describe, expect, it, vi } from "vitest";
import { GtmReadCache } from "../GtmReadCache";
import { createMcpApiHandler } from "../mcpHandler";

type ToolReply = {
  result?: { isError?: boolean; content: { text: string }[] };
  error?: unknown;
};

const records: unknown[] = [];
const objects = new Map<string, GtmReadCache>();
const objectNames: string[] = [];
const env = {
  GOOGLE_CLIENT_ID: "google-client",
  GTM_SNAPSHOT_CACHE_ENABLED: "true",
  GTM_USAGE: { writeDataPoint: (record: unknown) => records.push(record) },
  GTM_READ_CACHE: {
    idFromName(name: string) {
      objectNames.push(name);
      return name;
    },
    get(name: string): {
      fetch(input: string, init: RequestInit): Promise<Response>;
    } {
      if (!objects.has(name))
        objects.set(name, new GtmReadCache({} as DurableObjectState, env));
      return {
        fetch: (input: string, init: RequestInit) =>
          objects.get(name)!.fetch(new Request(input, init)),
      };
    },
  },
} as unknown as Env;

const props = {
  userId: "user-1",
  clientId: "client-1",
  name: "Test user",
  email: "private@example.com",
  accessToken: "private-access-token",
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
};

async function call(
  args: Record<string, unknown>,
  grant = props,
  name = "gtm_tag",
  workerEnv = env,
): Promise<ToolReply> {
  const handler = createMcpApiHandler(workerEnv);
  const response = await handler.fetch(
    new Request("https://gtm-mcp.example/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }) as never,
    workerEnv,
    {
      props: grant,
      waitUntil: () => {},
      passThroughOnException: () => {},
    } as unknown as ExecutionContext,
  );
  const text = await response.text();
  const payload = text.startsWith("event:")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5))
        .join("")
    : text;
  return JSON.parse(payload) as ToolReply;
}

const args = {
  action: "list",
  accountId: "1",
  containerId: "2",
  workspaceId: "3",
};

afterEach(() => {
  objects.clear();
  records.length = 0;
  objectNames.length = 0;
  vi.unstubAllGlobals();
});

describe("hosted snapshot cache", () => {
  it("shares snapshots between separate stateless HTTP requests and records only real Google attempts", async () => {
    const google = vi.fn(async () =>
      Response.json({
        tag: Array.from({ length: 40 }, (_, index) => ({
          name: String(index),
        })),
      }),
    );
    vi.stubGlobal("fetch", google);
    const first = await call(args);
    const second = await call({ ...args, page: 2 });
    expect(first.result?.isError).not.toBe(true);
    expect(second.result?.isError).not.toBe(true);
    expect(JSON.parse(second.result!.content[0].text).data[0].name).toBe("20");
    expect(google).toHaveBeenCalledTimes(1);
    const data = records as { blobs: string[] }[];
    expect(
      data.filter((record) => record.blobs[0] === "tool_call"),
    ).toHaveLength(2);
    expect(
      data.filter((record) => record.blobs[0] === "google_attempt"),
    ).toHaveLength(1);
    expect(data.some((record) => record.blobs[3] === "hit")).toBe(true);
    for (const secret of [
      props.accessToken,
      props.email,
      props.userId,
      props.clientId,
      "accounts/1/",
    ])
      expect(JSON.stringify(records)).not.toContain(secret);
    expect(JSON.stringify(objectNames)).not.toContain(props.accessToken);
  });

  it("isolates Google users, MCP clients and credential generations", async () => {
    const google = vi.fn(async () => Response.json({ tag: [] }));
    vi.stubGlobal("fetch", google);
    await call(args);
    await call(args, {
      ...props,
      userId: "user-2",
      accessToken: "other-user-token",
    });
    await call(args, { ...props, clientId: "client-2" });
    await call(args, { ...props, accessToken: "rotated-token" });
    await call(args);
    expect(google).toHaveBeenCalledTimes(4);
    expect(objects.size).toBe(2);
  });

  it("invalidates snapshots across MCP clients after a workspace mutation", async () => {
    const google = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", google);
    await call(args);
    await call(
      { ...args, action: "sync" },
      { ...props, clientId: "client-2" },
      "gtm_workspace",
    );
    await call(args);
    expect(google).toHaveBeenCalledTimes(3);
  });

  it("rejects expired credentials before consulting a cached snapshot", async () => {
    const google = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", google);
    await call(args);
    const result = await call(args, { ...props, expiresAt: 1 });
    expect(result.result?.isError).toBe(true);
    expect(google).toHaveBeenCalledTimes(1);
  });

  it("supports a rollout switch without consulting the hosted cache", async () => {
    const google = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", google);
    const disabled = { ...env, GTM_SNAPSHOT_CACHE_ENABLED: "false" };
    await call(args, props, "gtm_tag", disabled);
    await call(args, props, "gtm_tag", disabled);
    expect(google).toHaveBeenCalledTimes(2);
    expect(objects.size).toBe(0);
  });
});
