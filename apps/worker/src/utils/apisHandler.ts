import type {
  AuthRequest,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import {
  GOOGLE_AUTHORIZE_URL,
  GOOGLE_TOKEN_URL,
  GTM_OAUTH_SCOPES,
} from "google-tag-manager-mcp-core";
import { Context, Hono } from "hono";
import {
  fetchUpstreamAuthToken,
  getUpstreamAuthorizeUrl,
  Props,
} from "./authorizeUtils";
import { renderMainPage } from "./renderMainPage";
import { renderPrivacyPage } from "./renderPrivacyPage";
import { renderTermsPage } from "./renderTermsPage";
import {
  clientIdAlreadyApproved,
  parseRedirectApproval,
  renderApprovalDialog,
} from "./workersOAuthUtils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

app.get("/authorize", async (c) => {
  const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const { clientId } = oauthReqInfo;

  if (!clientId) {
    return c.text("Invalid request", 400);
  }

  if (
    await clientIdAlreadyApproved(
      c.req.raw,
      oauthReqInfo.clientId,
      c.env.COOKIE_ENCRYPTION_KEY,
    )
  ) {
    return redirectToGoogle(c, oauthReqInfo);
  }

  return renderApprovalDialog(c.req.raw, {
    client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
    server: {
      name: "STAPE.AI",
      description: "",
    },
    state: { oauthReqInfo },
  });
});

app.post("/authorize", async (c) => {
  const { state, headers } = await parseRedirectApproval(
    c.req.raw,
    c.env.COOKIE_ENCRYPTION_KEY,
  );

  if (!state.oauthReqInfo) {
    return c.text("Invalid request", 400);
  }

  return redirectToGoogle(c, state.oauthReqInfo, headers);
});

async function redirectToGoogle(
  c: Context,
  oauthReqInfo: AuthRequest,
  headers: Record<string, string> = {},
) {
  console.log(`/redirectToGoogle oauthReqInfo`, oauthReqInfo);

  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        upstreamUrl: GOOGLE_AUTHORIZE_URL,
        scope: GTM_OAUTH_SCOPES.join(" "),
        clientId: c.env.GOOGLE_CLIENT_ID,
        redirectUri: new URL("/callback", c.req.raw.url).href,
        state: btoa(JSON.stringify(oauthReqInfo)),
        hostedDomain: c.env.HOSTED_DOMAIN,
        hasRefreshToken: false,
      }),
    },
  });
}

app.get("/callback", async (c) => {
  // Get the oathReqInfo out of KV
  const oauthReqInfo = JSON.parse(
    atob(c.req.query("state") as string),
  ) as AuthRequest;

  if (!oauthReqInfo.clientId) {
    return c.text("Invalid state", 400);
  }

  const code = c.req.query("code");

  if (!code) {
    return c.text("Missing code", 400);
  }

  const [tokenResult, googleErrResponse] = await fetchUpstreamAuthToken({
    upstreamUrl: GOOGLE_TOKEN_URL,
    clientId: c.env.GOOGLE_CLIENT_ID,
    clientSecret: c.env.GOOGLE_CLIENT_SECRET,
    code,
    redirectUri: new URL("/callback", c.req.url).href,
    grantType: "authorization_code",
  });

  if (googleErrResponse) {
    return googleErrResponse;
  }

  const userResponse = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenResult?.access_token}`,
      },
    },
  );

  if (!userResponse.ok) {
    return c.text(
      `Failed to fetch user info: ${await userResponse.text()}`,
      500,
    );
  }

  const { id, name, email } = (await userResponse.json()) as {
    id: string;
    name: string;
    email: string;
  };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReqInfo,
    userId: id,
    metadata: {
      label: name,
    },
    scope: oauthReqInfo.scope,
    props: {
      name,
      email,
      accessToken: tokenResult.access_token,
      refreshToken: tokenResult.refresh_token,
      expiresAt:
        Math.floor(Date.now() / 1000) + (tokenResult.expires_in ?? 3600),
      clientId: oauthReqInfo.clientId,
      userId: id,
    } satisfies Props,
  });

  const url = new URL(redirectTo);
  url.searchParams.set("email", email);
  return Response.redirect(url.toString());
});

app.get("/remove", async (c) => {
  const userId = c.req.query("userId");
  const clientId = c.req.query("clientId");
  const accessToken = c.req.query("accessToken");

  if (!userId || !clientId || !accessToken) {
    return new Response("Invalid request", {
      status: 400,
    });
  }

  const listUserGrants = await c.env.OAUTH_PROVIDER.listUserGrants(userId);
  const revokeGrantRequests = listUserGrants.items.map((item) => {
    return c.env.OAUTH_PROVIDER.revokeGrant(item.id, item.userId);
  });

  await Promise.all(revokeGrantRequests);
  await c.env.OAUTH_PROVIDER.deleteClient(clientId);
  await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
    method: "POST",
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
    },
  });

  return new Response("OK", {
    status: 200,
  });
});

app.get("/", async () => {
  return new Response(renderMainPage(), {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  });
});

app.get("/privacy", async () => {
  return new Response(renderPrivacyPage(), {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  });
});

app.get("/terms", async () => {
  return new Response(renderTermsPage(), {
    headers: {
      "content-type": "text/html;charset=UTF-8",
    },
  });
});

export { app as apisHandler };
