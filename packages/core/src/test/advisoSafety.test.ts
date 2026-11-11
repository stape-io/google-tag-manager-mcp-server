import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Tool } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createHarness, McpHarness } from "./mcpHarness.js";
import { useGoogleApiStub } from "./googleApiStub.js";
import { GTM_API_SCOPES } from "../constants/scopes.js";
import { RESULT_ADDENDA } from "../adviso/safetyPolicy.js";
import { GtmToolRegistration } from "../types/index.js";

/* eslint-disable @typescript-eslint/no-explicit-any */

const FORBIDDEN_ACTIONS = ["publish", "remove", "delete", "undelete"];
const api = useGoogleApiStub();

// A tool with a permissive schema, so calls reach the runtime guard instead of
// being rejected by schema validation first.
const probe: GtmToolRegistration = (server) => {
  server.registerTool(
    "adviso_probe",
    {
      description: "Test only.",
      inputSchema: z.object({
        action: z.string(),
        changeStatus: z.string().optional(),
        changes: z.array(z.object({ changeStatus: z.string() })).optional(),
      }),
    },
    async () => ({ content: [{ type: "text", text: "handler ran" }] }),
  );
};

describe("Adviso safety policy", () => {
  let harness: McpHarness;
  let tools: Tool[];

  beforeAll(async () => {
    harness = await createHarness({ extraTools: [probe] });
    ({ tools } = await harness.client.listTools());
  });
  afterAll(async () => harness.close());

  const call = (name: string, args: Record<string, unknown>): Promise<any> =>
    harness.client
      .callTool({ name, arguments: args })
      .catch((e: Error) => ({ isError: true, content: [{ text: e.message }] }));

  it("does not request destructive or admin OAuth scopes", () => {
    const joined = GTM_API_SCOPES.join(" ");
    for (const s of [
      "publish",
      "delete.containers",
      "manage.users",
      "manage.accounts",
    ]) {
      expect(joined).not.toContain(s);
    }
  });

  it("does not register the user permission tool", () => {
    expect(tools.map((t) => t.name)).not.toContain("gtm_user_permission");
  });

  it("exposes no destructive action in any tool schema", () => {
    for (const tool of tools) {
      const values: string[] =
        (tool.inputSchema as any)?.properties?.action?.enum ?? [];
      for (const bad of FORBIDDEN_ACTIONS) {
        expect(values, `${tool.name} exposes '${bad}'`).not.toContain(bad);
      }
    }
    const account = tools.find((t) => t.name === "gtm_account") as any;
    expect(account.inputSchema.properties.action.enum).toEqual(["get", "list"]);
  });

  it("does not offer the 'deleted' status in workspace bulkUpdate", () => {
    const workspace = tools.find((t) => t.name === "gtm_workspace") as any;
    const statuses =
      workspace.inputSchema.properties.changes.items.properties.changeStatus
        .enum;
    expect(statuses).toEqual(["added", "updated"]);
  });

  it("drops blocked actions from tool descriptions", () => {
    const version = tools.find((t) => t.name === "gtm_version")!;
    expect(version.description).toContain("get, live, setLatest, update");
    expect(version.description).not.toMatch(/\bpublish\b,|\bundelete\b/);
    expect(version.description).toContain("Adviso build");
  });

  it("rejects a blocked action on a real tool without calling Google", async () => {
    const res = await call("gtm_version", {
      action: "publish",
      accountId: "1",
      containerId: "2",
      containerVersionId: "3",
      fingerprint: "x",
    });
    expect(res.isError).toBe(true);
    expect(api.calls).toHaveLength(0);
  });

  it.each(FORBIDDEN_ACTIONS)(
    "refuses '%s' at runtime when the schema lets it through",
    async (action) => {
      const res = await call("adviso_probe", { action });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("disabled in the Adviso build");
    },
  );

  it("refuses 'deleted' changes at runtime (resolveConflict and bulkUpdate)", async () => {
    for (const args of [
      { action: "resolveConflict", changeStatus: "deleted" },
      {
        action: "bulkUpdate",
        changes: [{ changeStatus: "added" }, { changeStatus: "deleted" }],
      },
    ]) {
      const res = await call("adviso_probe", args);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("'deleted'");
    }
  });

  it("lets allowed calls through", async () => {
    const res = await call("adviso_probe", {
      action: "update",
      changes: [{ changeStatus: "updated" }],
    });
    expect(res.isError).not.toBe(true);
    expect(res.content[0].text).toBe("handler ran");
  });

  it("tells the model to stop before publishing in the guide", async () => {
    const res = await call("gtm_guide", { topic: "safeEditing" });
    expect(res.content.at(-1).text).toBe(RESULT_ADDENDA.gtm_guide);
  });
});
