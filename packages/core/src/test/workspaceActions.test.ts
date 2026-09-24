import { describe, expect, it } from "vitest";
import {
  json,
  TEST_WORKSPACE_PATH,
  useGoogleApiStub,
} from "./googleApiStub.js";

const google = useGoogleApiStub();

describe("gtm_workspace bulkUpdate", () => {
  const trigger = {
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
    triggerId: "new_1",
    name: "CE - purchase",
    type: "customEvent",
  };
  const tag = {
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
    tagId: "new_2",
    name: "GA4 - Event - purchase",
    type: "gaawe",
    firingTriggerId: ["new_1"],
  };
  const args = {
    action: "bulkUpdate",
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
  };

  it("sends all changes in a single bulk_update call", async () => {
    google.respond = (): Response =>
      json({ changes: [{ trigger: { triggerId: "10" } }] });

    const { isError, text } = await google.callTool("gtm_workspace", {
      ...args,
      changes: [
        { changeStatus: "added", entity: { trigger } },
        { changeStatus: "added", entity: { tag } },
      ],
    });

    expect(isError).toBeFalsy();
    expect(JSON.parse(text).changes).toHaveLength(1);
    expect(google.calls).toHaveLength(1);
    expect(google.calls[0].method).toBe("POST");
    expect(new URL(google.calls[0].url).pathname).toBe(
      `/tagmanager/v2/${TEST_WORKSPACE_PATH}/bulk_update`,
    );
    // Sent in the API's flat Entity shape.
    expect(JSON.parse(google.calls[0].body)).toEqual({
      changes: [
        { changeStatus: "added", trigger },
        { changeStatus: "added", tag },
      ],
    });
  });

  it("refuses an empty change list without calling Google", async () => {
    const { isError } = await google.callTool("gtm_workspace", {
      ...args,
      changes: [],
    });

    expect(isError).toBe(true);
    expect(google.calls).toHaveLength(0);
  });

  it.each([
    ["without changeStatus", { entity: { trigger } }],
    // The GTM API rejects 'modified' - its value is 'updated'.
    [
      "with changeStatus 'modified'",
      { changeStatus: "modified", entity: { trigger } },
    ],
  ])("rejects a change %s at schema validation", async (_, change) => {
    const { isError, text } = await google.callTool("gtm_workspace", {
      ...args,
      changes: [change],
    });

    expect(isError).toBe(true);
    expect(text).toContain("Input validation error");
    expect(google.calls).toHaveLength(0);
  });
});
