import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, McpHarness } from "./mcpHarness.js";
import { normalizeToolsList } from "./normalizeTools.js";
import { PACKAGE_VERSION } from "../version.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, "__golden__", "tools.json");
const DESCRIPTION_MAX_LENGTH = 1024; // Gemini's known rejection ceiling.

describe("tool registry", () => {
  let harness: McpHarness;
  let tools: Tool[];

  beforeAll(async () => {
    harness = await createHarness();
    ({ tools } = await harness.client.listTools());
  });

  afterAll(async () => {
    await harness.close();
  });

  it("matches the committed golden tools/list snapshot", () => {
    const actual = normalizeToolsList(tools);
    // This fixture is manual-regeneration-only: it is never written by this test.
    // If it's missing, generate it deliberately, hand-inspect it, then commit it.
    const expected = readFileSync(GOLDEN_PATH, "utf-8");
    expect(actual).toBe(expected);
  });

  it("upholds schema invariants for every registered tool", () => {
    expect(tools.length).toBeGreaterThan(0);

    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);

    for (const tool of tools) {
      const schema = tool.inputSchema as {
        properties?: Record<string, unknown>;
      };
      const properties = schema.properties ?? {};
      expect(
        Object.keys(properties).length,
        `${tool.name}: inputSchema must declare at least one property`,
      ).toBeGreaterThan(0);

      const action = properties["action"] as
        { enum?: unknown[]; description?: string } | undefined;
      if (action !== undefined) {
        expect(
          Array.isArray(action.enum) && action.enum.length > 0,
          `${tool.name}: 'action' parameter must be a z.enum`,
        ).toBe(true);
        expect(
          typeof action.description === "string" &&
            action.description.trim().length > 0,
          `${tool.name}: 'action' parameter must have a non-empty .describe()`,
        ).toBe(true);
      }

      expect(
        typeof tool.description === "string" &&
          tool.description.length < DESCRIPTION_MAX_LENGTH,
        `${tool.name}: description must be under ${DESCRIPTION_MAX_LENGTH} characters`,
      ).toBe(true);
    }
  });

  it("negotiates the expected server identity and capabilities on initialize", () => {
    // A real (unmocked) check of what createHarness()'s initialize handshake
    // negotiated - would catch an SDK swap silently changing this.
    expect(harness.client.getServerVersion()).toEqual({
      name: "google-tag-manager-mcp-server",
      version: PACKAGE_VERSION,
    });
    expect(harness.client.getServerCapabilities()?.tools).toBeDefined();
  });

  it("rejects tools/call with missing required arguments before any handler logic runs", async () => {
    // No accountId: zod schema validation must reject this before the gtm_account
    // handler runs - so no getTagManagerClient()/network call is ever attempted.
    const result = await harness.client.callTool({
      name: "gtm_account",
      arguments: { action: "get" },
    });
    expect(result.isError).toBe(true);
  });
});
