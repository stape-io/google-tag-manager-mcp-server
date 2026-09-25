import { afterEach, describe, expect, it, vi } from "vitest";
import { UNAUTHORIZED_HINT } from "../constants/tools";
import { removeMCPServerData } from "../tools/removeMCPServerData";
import { apisHandler } from "../utils/apisHandler";
import {
  handleTokenExchangeCallback,
  Props,
  UpstreamReauthRequiredError,
} from "../utils/authorizeUtils";

/**
 * Regression tests for the re-auth prompts reproduced in
 * https://github.com/stape-io/google-tag-manager-mcp-server/issues/58 and #15.
 */

const ENV = {
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
} as unknown as Env;

const PROPS: Props = {
  userId: "user-1",
  clientId: "client-1",
  name: "Test User",
  email: "test@example.com",
  accessToken: "google-access",
  refreshToken: "google-refresh",
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refresh_token exchange", () => {
  // A client that refreshes lazily (Claude's connector, mcp-remote without an
  // SSE stream) refreshes whenever it next needs the token. If the Google
  // token has 900-1800 s left, the old 900 s threshold skipped the Google
  // refresh but still issued a 1800 s MCP token, so tool calls failed with
  // "Access token expired" until the MCP token expired too.
  it.each([1500, 901, 1799])(
    "never issues an MCP token that outlives the Google token (%is left)",
    async (secondsLeft) => {
      vi.stubGlobal("fetch", async () =>
        Response.json({ access_token: "google-access-2", expires_in: 3599 }),
      );
      const googleExpiresAt = nowSeconds() + secondsLeft;

      const result = await handleTokenExchangeCallback(
        {
          grantType: "refresh_token",
          props: { ...PROPS, expiresAt: googleExpiresAt },
        },
        ENV,
      );

      const effectiveGoogleExpiry =
        (result?.newProps as Props | undefined)?.expiresAt ?? googleExpiresAt;
      expect(nowSeconds() + result!.accessTokenTTL).toBeLessThanOrEqual(
        effectiveGoogleExpiry,
      );
    },
  );

  // Every Google refresh is a chance for Google to fail, and a failure used
  // to force a new login, so don't refresh more often than its token needs.
  it("skips the Google refresh while its token still has 30 min left", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await handleTokenExchangeCallback(
      {
        grantType: "refresh_token",
        props: { ...PROPS, expiresAt: nowSeconds() + 1799 },
      },
      ENV,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["Google answers 503", async () => new Response("busy", { status: 503 })],
    [
      "the network fails",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])(
    "keeps the session when %s while its token is still valid",
    async (_case, fetchImpl) => {
      vi.stubGlobal("fetch", fetchImpl);
      const googleExpiresAt = nowSeconds() + 600;

      const result = await handleTokenExchangeCallback(
        {
          grantType: "refresh_token",
          props: { ...PROPS, expiresAt: googleExpiresAt },
        },
        ENV,
      );

      expect(result!.accessTokenTTL).toBeGreaterThanOrEqual(60);
      expect(nowSeconds() + result!.accessTokenTTL).toBeLessThanOrEqual(
        googleExpiresAt,
      );
    },
  );

  it("asks for a new login when Google rejects the refresh token", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
    );

    await expect(
      handleTokenExchangeCallback(
        {
          grantType: "refresh_token",
          props: { ...PROPS, expiresAt: nowSeconds() + 600 },
        },
        ENV,
      ),
    ).rejects.toBeInstanceOf(UpstreamReauthRequiredError);
  });
});

describe("/callback", () => {
  // Desktop's spawn/kill churn and mcp-remote's re-auth takeovers leave stale
  // login tabs around. Completing one used to revoke every other grant of the
  // same user + client, including the one whose tokens the client had just
  // saved, so its next refresh failed with "Grant not found" and prompted again.
  it("does not revoke the user's other grants for the same client", async () => {
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) =>
      String(input).includes("userinfo")
        ? Response.json({ id: "user-1", name: "Test User", email: "t@e.st" })
        : Response.json({
            access_token: "google-access",
            refresh_token: "google-refresh",
            expires_in: 3599,
          }),
    );
    const completeAuthorization = vi.fn(async () => ({
      redirectTo: "http://127.0.0.1:4305/oauth/callback?code=c",
    }));
    const state = btoa(JSON.stringify({ clientId: "client-1", scope: [] }));

    const response = await apisHandler.request(
      `https://gtm-mcp.example/callback?code=google-code&state=${state}`,
      {},
      { ...ENV, OAUTH_PROVIDER: { completeAuthorization } },
    );

    expect(response.status).toBe(302);
    expect(completeAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ revokeExistingGrants: false }),
    );
  });
});

describe("gtm_remove_session", () => {
  function fakeOAuth() {
    const grants = [
      { id: "g-this-1", clientId: "client-1", userId: "user-1" },
      { id: "g-this-2", clientId: "client-1", userId: "user-1" },
      { id: "g-desktop", clientId: "client-2", userId: "user-1" },
      { id: "g-cursor", clientId: "client-3", userId: "user-1" },
    ];
    return {
      grants,
      listUserGrants: vi.fn(async () => ({ items: [...grants] })),
      revokeGrant: vi.fn(async (id: string) => {
        grants.splice(
          grants.findIndex((g) => g.id === id),
          1,
        );
      }),
      deleteClient: vi.fn(async () => {}),
    };
  }

  type ToolResult = { isError?: boolean; content?: { text: string }[] };

  async function callTool(oauth: ReturnType<typeof fakeOAuth>) {
    let handler: () => Promise<ToolResult> = async () => ({});
    const server = {
      registerTool: (_name: string, _config: unknown, cb: typeof handler) => {
        handler = cb;
      },
    };
    removeMCPServerData(server as never, { props: PROPS, oauth } as never);
    return handler();
  }

  // One window calling it used to revoke every grant of the Google user and
  // the Google token itself, logging out every other client.
  it("signs out only the calling client", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const oauth = fakeOAuth();

    const result = await callTool(oauth);

    expect(result.isError).toBeFalsy();
    expect(oauth.grants.map((g) => g.id)).toEqual(["g-desktop", "g-cursor"]);
    expect(fetch).not.toHaveBeenCalled();
  });

  // With nothing else of this user left on the server, full cleanup can't log
  // anyone out, so hand Google its token back too.
  it("revokes Google access when no other client is signed in", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const oauth = fakeOAuth();
    oauth.grants.splice(2);

    const result = await callTool(oauth);

    expect(result.isError).toBeFalsy();
    expect(oauth.grants).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://oauth2.googleapis.com/revoke");
    expect(String(init.body)).toBe("token=google-refresh");
  });

  it("still signs out when Google's revoke fails", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const oauth = fakeOAuth();
    oauth.grants.splice(2);

    const result = await callTool(oauth);

    expect(result.isError).toBeFalsy();
    expect(oauth.grants).toEqual([]);
  });

  // Revoking the grants already forces a clean login on the next request.
  // Deleting the registration too strands clients that reconnect with the
  // same client_id (a Claude connector's "Reconnect"): the server no longer
  // knows it.
  it("keeps the client registration so the client can sign in again", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const oauth = fakeOAuth();

    await callTool(oauth);

    expect(oauth.deleteClient).not.toHaveBeenCalled();
  });

  // `rm -rf ~/.mcp-auth` wiped the sign-ins of every mcp-remote server, not
  // just this one. mcp-remote drops its own tokens once the grant is gone.
  it("doesn't tell the user to delete local auth files", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const result = await callTool(fakeOAuth());

    expect(result.content?.[0]?.text).not.toMatch(/rm |\.mcp-auth/);
  });
});

describe("unauthorized hint", () => {
  // A Google 401 now means Google itself dropped the token, which a new
  // sign-in fixes. Pointing models at gtm_remove_session turned that into a
  // sign-out of the whole client.
  it("asks to reconnect instead of removing the session", () => {
    expect(UNAUTHORIZED_HINT).toMatch(/reconnect/i);
    expect(UNAUTHORIZED_HINT).not.toMatch(/gtm_remove_session/);
  });
});

describe("/remove", () => {
  // It trusted userId/clientId from the query string, so anyone who knew a
  // Google user id could revoke all of that user's grants.
  it("no longer exists", async () => {
    const revokeGrant = vi.fn();
    const listUserGrants = vi.fn(async () => ({
      items: [{ id: "g", clientId: "client-1", userId: "user-1" }],
    }));

    const response = await apisHandler.request(
      "https://gtm-mcp.example/remove?userId=user-1&clientId=client-1&accessToken=x",
      {},
      {
        ...ENV,
        OAUTH_PROVIDER: { listUserGrants, revokeGrant, deleteClient: vi.fn() },
      },
    );

    expect(response.status).toBe(404);
    expect(revokeGrant).not.toHaveBeenCalled();
  });
});
