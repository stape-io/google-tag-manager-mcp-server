import { describe, expect, it } from "vitest";
import { json, TEST_TOKEN, useGoogleApiStub } from "./googleApiStub.js";
import { GTM_API_SCOPES } from "../constants/index.js";

const google = useGoogleApiStub();

describe("gtm_auth_status", () => {
  it("reports granted and missing Tag Manager scopes without leaking the token", async () => {
    const [readonly, publish] = [
      "https://www.googleapis.com/auth/tagmanager.readonly",
      "https://www.googleapis.com/auth/tagmanager.publish",
    ];
    google.respond = (): Response =>
      json({
        scope: `email ${readonly} ${publish}`,
        expires_in: "1234",
        email: "user@example.com",
      });

    const { isError, text } = await google.callTool("gtm_auth_status", {});

    expect(isError).toBeFalsy();
    expect(text).not.toContain(TEST_TOKEN);
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

    expect(google.calls).toHaveLength(1);
    expect(google.calls[0].method).toBe("POST");
    expect(google.calls[0].url).toBe("https://oauth2.googleapis.com/tokeninfo");
    expect(google.calls[0].url).not.toContain(TEST_TOKEN);
    expect(new URLSearchParams(google.calls[0].body).get("access_token")).toBe(
      TEST_TOKEN,
    );
  });

  it("reports an expired/invalid token with the re-auth hint", async () => {
    google.respond = (): Response => json({ error: "invalid_token" }, 400);

    const { isError, text } = await google.callTool("gtm_auth_status", {});
    const status = JSON.parse(text);

    expect(isError).toBeFalsy();
    expect(status.authenticated).toBe(false);
    expect(status.error).toContain("400");
    expect(status.hint).toMatch(/re-authenticate/);
  });

  it.each([429, 503])(
    "does not blame the token for a tokeninfo HTTP %i",
    async (httpStatus) => {
      google.respond = (): Response => json({ error: "busy" }, httpStatus);

      const { text } = await google.callTool("gtm_auth_status", {});
      const status = JSON.parse(text);

      expect(status.authenticated).toBe("unknown");
      expect(status.error).toContain(String(httpStatus));
      expect(status.hint).toBeUndefined();
    },
  );

  it("returns an error result when tokeninfo is unreachable", async () => {
    google.respond = (): Response => {
      throw new TypeError("fetch failed");
    };

    const { isError, text } = await google.callTool("gtm_auth_status", {});

    expect(isError).toBe(true);
    expect(text).toContain("fetch failed");
    expect(text).not.toContain(TEST_TOKEN);
  });

  it("reports a credential provider failure without calling Google", async () => {
    const { text } = await google.callTool(
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
    expect(google.calls).toHaveLength(0);
  });
});
