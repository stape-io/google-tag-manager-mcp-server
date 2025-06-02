import type {
  AuthRequest,
  OAuthHelpers,
} from "@cloudflare/workers-oauth-provider";
import { Context, Hono } from "hono";
import {
  fetchUpstreamAuthToken,
  getUpstreamAuthorizeUrl,
  Props,
} from "./authorizeUtils";
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
      name: "MCP Server for Google Tag Manager",
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

  const scopes = [
    "email",
    "profile",
    "https://www.googleapis.com/auth/tagmanager.manage.accounts",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.delete.containers",
    "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
    "https://www.googleapis.com/auth/tagmanager.manage.users",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/tagmanager.readonly",
  ];
  return new Response(null, {
    status: 302,
    headers: {
      ...headers,
      location: getUpstreamAuthorizeUrl({
        upstreamUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        scope: scopes.join("  "),
        clientId: c.env.GOOGLE_CLIENT_ID,
        redirectUri: new URL("/callback", c.req.raw.url).href,
        state: btoa(JSON.stringify(oauthReqInfo)),
        hostedDomain: c.env.HOSTED_DOMAIN,
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

  const [accessToken, googleErrResponse] = await fetchUpstreamAuthToken({
    upstreamUrl: "https://accounts.google.com/o/oauth2/token",
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
        Authorization: `Bearer ${accessToken}`,
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
      accessToken,
      clientId: oauthReqInfo.clientId,
      userId: id,
    } as Props,
  });

  return Response.redirect(redirectTo);
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

export { app as apisHandler };
