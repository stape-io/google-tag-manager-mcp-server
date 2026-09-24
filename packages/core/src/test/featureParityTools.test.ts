import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHarness, McpHarness } from "./mcpHarness.js";
import { GTM_API_SCOPES } from "../constants/index.js";
import { GUIDES } from "../tools/guideActions.js";
import { GtmAuthProvider } from "../types/index.js";

const TOKEN = "secret-test-token";
const WORKSPACE_PATH = "accounts/1/containers/2/workspaces/3";

type FetchCall = { url: string; method: string; body: string };

let fetchCalls: FetchCall[];
let respond: (call: FetchCall) => Response;
let harness: McpHarness | undefined;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// googleapis' HTTP layer (gaxios) only uses `window.fetch` when `window`
// exists and otherwise falls back to `node-fetch`, caching that choice for the
// process. A delegating `window.fetch` routes its calls to the stubbed global
// `fetch` below, so no test here can reach the real network.
const windowShim = {
  fetch: (...args: Parameters<typeof fetch>): Promise<Response> =>
    globalThis.fetch(...args),
};

beforeEach(() => {
  vi.stubGlobal("window", windowShim);
  fetchCalls = [];
  respond = (): Response => json({});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      const call = {
        url: request.url,
        method: request.method,
        body: await request.text(),
      };
      fetchCalls.push(call);
      return respond(call);
    }),
  );
});

afterEach(async () => {
  await harness?.close();
  harness = undefined;
  vi.unstubAllGlobals();
});

async function call(
  name: string,
  args: Record<string, unknown>,
  auth?: GtmAuthProvider,
): Promise<{ isError?: boolean; text: string }> {
  harness = await createHarness({
    auth: auth ?? { getAccessToken: async (): Promise<string> => TOKEN },
  });
  const result = await harness.client.callTool({ name, arguments: args });
  return {
    isError: result.isError as boolean | undefined,
    text: (result.content as { text: string }[])[0].text,
  };
}

describe("gtm_auth_status", () => {
  it("reports granted and missing Tag Manager scopes without leaking the token", async () => {
    const [readonly, publish] = [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.publish",
    ];
    respond = (): Response =>
      json({
        scope: `email ${readonly} ${publish}`,
        expires_in: "1234",
        email: "user@example.com",
      });

    const { isError, text } = await call("gtm_auth_status", {});

    expect(isError).toBeFalsy();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toEqual({
      authenticated: true,
      email: "user@example.com",
      expiresInSeconds: 1234,
      grantedScopes: [readonly, publish],
      missingScopes: GTM_API_SCOPES.filter(
        (scope) => scope !== readonly && scope !== publish,
      ),
      missingScopesNote: expect.stringContaining("403"),
    });

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].method).toBe("POST");
    expect(fetchCalls[0].url).toBe("https://oauth2.googleapis.com/tokeninfo");
    expect(fetchCalls[0].url).not.toContain(TOKEN);
    expect(new URLSearchParams(fetchCalls[0].body).get("access_token")).toBe(
      TOKEN,
    );
  });

  it("reports an expired/invalid token with the re-auth hint", async () => {
    respond = (): Response => json({ error: "invalid_token" }, 400);

    const { isError, text } = await call("gtm_auth_status", {});
    const status = JSON.parse(text);

    expect(isError).toBeFalsy();
    expect(status.authenticated).toBe(false);
    expect(status.error).toContain("400");
    expect(status.hint).toMatch(/re-authenticate/);
  });

  it.each([429, 503])(
    "does not blame the token for a tokeninfo HTTP %i",
    async (httpStatus) => {
      respond = (): Response => json({ error: "busy" }, httpStatus);

      const { text } = await call("gtm_auth_status", {});
      const status = JSON.parse(text);

      expect(status.authenticated).toBe("unknown");
      expect(status.error).toContain(String(httpStatus));
      expect(status.hint).toBeUndefined();
    },
  );

  it("returns an error result when tokeninfo is unreachable", async () => {
    respond = (): Response => {
      throw new TypeError("fetch failed");
    };

    const { isError, text } = await call("gtm_auth_status", {});

    expect(isError).toBe(true);
    expect(text).toContain("fetch failed");
    expect(text).not.toContain(TOKEN);
  });

  it("reports a credential provider failure without calling Google", async () => {
    const { text } = await call(
      "gtm_auth_status",
      {},
      {
        getAccessToken: async () => {
          throw new Error("refresh token revoked");
        },
      },
    );
    const status = JSON.parse(text);

    expect(status.authenticated).toBe(false);
    expect(status.error).toContain("refresh token revoked");
    expect(status.hint).toBeUndefined();
    expect(fetchCalls).toHaveLength(0);
  });
});

describe("gtm_guide", () => {
  it.each(Object.keys(GUIDES))("returns the '%s' guide", async (topic) => {
    const { isError, text } = await call("gtm_guide", { topic });

    expect(isError).toBeFalsy();
    expect(text).toBe(GUIDES[topic as keyof typeof GUIDES]);
    expect(text.startsWith("# ")).toBe(true);
    expect(fetchCalls).toHaveLength(0);
  });

  it("rejects an unknown topic", async () => {
    const { isError } = await call("gtm_guide", { topic: "nope" });
    expect(isError).toBe(true);
  });
});

describe("gtm_template importFromGallery", () => {
  const args = {
    action: "importFromGallery",
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
    galleryOwner: "stape-io",
    galleryRepository: "facebook-tag",
  };

  it("calls templates:import_from_gallery with the gallery coordinates", async () => {
    respond = (): Response => json({ templateId: "42", name: "Facebook CAPI" });

    const { isError, text } = await call("gtm_template", {
      ...args,
      gallerySha: "abc123",
      acknowledgePermissions: true,
    });

    expect(isError).toBeFalsy();
    expect(JSON.parse(text).templateId).toBe("42");
    expect(fetchCalls).toHaveLength(1);

    const url = new URL(fetchCalls[0].url);
    expect(fetchCalls[0].method).toBe("POST");
    expect(url.pathname).toBe(
      `/tagmanager/v2/${WORKSPACE_PATH}/templates:import_from_gallery`,
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      galleryOwner: "stape-io",
      galleryRepository: "facebook-tag",
      gallerySha: "abc123",
      acknowledgePermissions: "true",
    });
  });

  it.each([
    ["acknowledgePermissions is missing", {}],
    ["acknowledgePermissions is false", { acknowledgePermissions: false }],
    [
      "galleryRepository is missing",
      { acknowledgePermissions: true, galleryRepository: undefined },
    ],
  ])("refuses without calling Google when %s", async (_, overrides) => {
    const { isError } = await call("gtm_template", { ...args, ...overrides });

    expect(isError).toBe(true);
    expect(fetchCalls).toHaveLength(0);
  });
});

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
    respond = (): Response =>
      json({ changes: [{ trigger: { triggerId: "10" } }] });
    const changes = [
      { changeStatus: "added", entity: { trigger } },
      { changeStatus: "added", entity: { tag } },
    ];

    const { isError, text } = await call("gtm_workspace", {
      ...args,
      changes,
    });

    expect(isError).toBeFalsy();
    expect(JSON.parse(text).changes).toHaveLength(1);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].method).toBe("POST");
    expect(new URL(fetchCalls[0].url).pathname).toBe(
      `/tagmanager/v2/${WORKSPACE_PATH}/bulk_update`,
    );
    // Sent in the API's flat Entity shape.
    expect(JSON.parse(fetchCalls[0].body)).toEqual({
      changes: [
        { changeStatus: "added", trigger },
        { changeStatus: "added", tag },
      ],
    });
  });

  it("refuses an empty change list without calling Google", async () => {
    const { isError } = await call("gtm_workspace", { ...args, changes: [] });

    expect(isError).toBe(true);
    expect(fetchCalls).toHaveLength(0);
  });

  it("rejects a change without changeStatus at schema validation", async () => {
    const { isError, text } = await call("gtm_workspace", {
      ...args,
      changes: [{ entity: { trigger } }],
    });

    expect(isError).toBe(true);
    expect(text).toContain("Input validation error");
    expect(fetchCalls).toHaveLength(0);
  });
});
