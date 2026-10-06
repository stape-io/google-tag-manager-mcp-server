import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer as McpServerV2 } from "@modelcontextprotocol/server";
import { registerGtmTools } from "google-tag-manager-mcp-core";
import { expect, it } from "vitest";
import { McpAgentPropsModel } from "../models/McpAgentModel";
import { removeMCPServerData } from "../tools/removeMCPServerData";

/**
 * `/sse` runs on `McpAgent`, which is feature-frozen on SDK v1, so its
 * `McpServer` is v1 while core's registrations and `removeMCPServerData` are
 * typed against v2's. `GoogleTagManagerMCPServer.init()` bridges that with a
 * type-only cast; this is the runtime half of that claim.
 *
 * It does NOT exercise the Durable Object, the SSE transport or `McpAgent`
 * itself - only the registration surface those forward to, which is the part
 * the SDK v2 migration changed.
 */
it("registers the v2 tool set on a v1 McpServer, as /sse does", async () => {
  const server = new McpServer({
    name: "google-tag-manager-mcp-server",
    version: "0.0.0-test",
  });

  const props = {
    userId: "u",
    name: "n",
    email: "e@example.com",
    accessToken: "t",
    clientId: "c",
  } satisfies McpAgentPropsModel;

  const legacyServer = server as unknown as McpServerV2;

  registerGtmTools(legacyServer, {
    auth: { getAccessToken: async () => "t" },
  });
  removeMCPServerData(legacyServer, {
    props,
    // Registration only; the tool is never called here.
    oauth: {} as OAuthHelpers,
  });

  const client = new Client({ name: "sse-compat-test", version: "0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);

  const { tools } = await client.listTools();

  expect(tools.length).toBeGreaterThanOrEqual(21);
  expect(tools.map((tool) => tool.name)).toContain("gtm_remove_session");
  expect(tools.map((tool) => tool.name)).toContain("gtm_auth_status");

  const guide = tools.find((tool) => tool.name === "gtm_guide");
  expect(Object.keys(guide?.inputSchema?.properties ?? {})).toEqual(["topic"]);

  // A no-network call through v1 dispatch: schema validation + handler.
  const guideResult = await client.callTool({
    name: "gtm_guide",
    arguments: { topic: "safeEditing" },
  });
  expect(guideResult.isError).toBeFalsy();
  expect((guideResult.content as { text: string }[])[0].text).toMatch(
    /^# Safe editing workflow/,
  );

  // The failure mode worth catching: v1 silently turning a v2-shaped
  // `inputSchema` into an empty/degenerate JSON Schema.
  const account = tools.find((tool) => tool.name === "gtm_account");

  expect(Object.keys(account?.inputSchema?.properties ?? {})).toContain(
    "action",
  );

  // Same failure mode, at dispatch: a missing required argument must be
  // rejected by zod validation before any real network call is attempted.
  const result = await client.callTool({
    name: "gtm_account",
    arguments: { action: "get" },
  });
  expect(result.isError).toBe(true);
  // isError alone doesn't discriminate schema-validation rejection from a
  // handler-thrown error (both land in the same broad try/catch) — assert
  // the actual validation message so this only passes when v1 genuinely
  // rejected the missing `accountId` before any handler logic ran.
  expect((result.content as { text: string }[])[0].text).toContain(
    "Input validation error",
  );

  await client.close();
  await server.close();
});
