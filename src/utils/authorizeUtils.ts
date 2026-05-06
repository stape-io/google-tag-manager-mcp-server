/**
 * Constructs an authorization URL for an upstream service.
 *
 * @param {Object} options
 * @param {string} options.upstream_url - The base URL of the upstream service.
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} [options.state] - The state parameter.
 * @param {string} [options.hosted_domain] - The hosted domain parameter.
 *
 * @returns {string} The authorization URL.
 */
export function getUpstreamAuthorizeUrl({
  upstreamUrl,
  clientId,
  scope,
  redirectUri,
  state,
  hostedDomain,
  hasRefreshToken,
}: {
  upstreamUrl: string;
  clientId: string;
  scope: string;
  redirectUri: string;
  state?: string;
  hostedDomain?: string;
  hasRefreshToken?: boolean;
}): string {
  const upstream = new URL(upstreamUrl);
  upstream.searchParams.set("client_id", clientId);
  upstream.searchParams.set("redirect_uri", redirectUri);
  upstream.searchParams.set("scope", scope);
  upstream.searchParams.set("response_type", "code");
  upstream.searchParams.set("access_type", "offline");
  if (state) upstream.searchParams.set("state", state);
  if (hostedDomain) upstream.searchParams.set("hd", hostedDomain);
  if (!hasRefreshToken) {
    upstream.searchParams.set("prompt", "consent");
  }
  return upstream.href;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Fetches an authorization token from an upstream service.
 *
 * @param {Object} options
 * @param {string} options.client_id - The client ID of the application.
 * @param {string} options.client_secret - The client secret of the application.
 * @param {string} options.code - The authorization code.
 * @param {string} options.redirect_uri - The redirect URI of the application.
 * @param {string} options.upstream_url - The token endpoint URL of the upstream service.
 * @param {string} options.grant_type - The grant type.
 *
 * @returns {Promise<[GoogleTokenResponse, null] | [null, Response]>} A promise that resolves to an array containing the access token or an error response.
 */
export async function fetchUpstreamAuthToken({
  clientId,
  clientSecret,
  code,
  redirectUri,
  upstreamUrl,
  grantType,
}: {
  code: string | undefined;
  upstreamUrl: string;
  clientSecret: string;
  redirectUri: string;
  clientId: string;
  grantType: string;
}): Promise<[GoogleTokenResponse, null] | [null, Response]> {
  if (!code) {
    return [null, new Response("Missing code", { status: 400 })];
  }

  const resp = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: grantType,
    }).toString(),
  });
  if (!resp.ok) {
    console.log(await resp.text());
    return [
      null,
      new Response("Failed to fetch access token", { status: 500 }),
    ];
  }

  const body = (await resp.json()) as GoogleTokenResponse;
  if (!body.access_token) {
    return [null, new Response("Missing access token", { status: 400 })];
  }
  return [body, null];
}

/**
 * Refreshes an authorization token from an upstream service.
 */
export async function refreshUpstreamAuthToken({
  clientId,
  clientSecret,
  refreshToken,
  upstreamUrl,
}: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  upstreamUrl: string;
}): Promise<[GoogleRefreshResponse, null] | [null, string]> {
  const resp = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    return [null, errorText];
  }

  const body = (await resp.json()) as GoogleRefreshResponse;
  if (!body.access_token) {
    return [null, "Missing access token in refresh response"];
  }

  return [body, null];
}

// Context from the auth process, encrypted & stored in the auth token
// and provided to the MyMCP as this.props
export type Props = {
  userId: string;
  clientId: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

/**
 * Handles the logic for exchanging an OAuth code or refreshing a token.
 */
export async function handleTokenExchangeCallback(
  { grantType, props }: { grantType: string; props?: any },
  env: Env,
) {
  const now = Math.floor(Date.now() / 1000);

  if (grantType === "authorization_code") {
    // Regular TTL for the MCP access token
    return { accessTokenTTL: 1800 };
  }

  if (grantType === "refresh_token") {
    console.log("[TokenExchange] Checking Google token refresh...");
    const p = props as Props;
    if (!p?.refreshToken) {
      console.error("[TokenExchange] Error: Missing Google refresh token.");
      throw new Error("Missing Google refresh token. Please re-authenticate.");
    }

    const expiresAt = p.expiresAt ?? 0;
    // Heartbeat: If token expires in less than 15 minutes, refresh it.
    const REFRESH_THRESHOLD = 900;
    if (expiresAt >= now + REFRESH_THRESHOLD) {
      console.log(
        `[TokenExchange] Token valid until ${expiresAt}. No refresh needed.`,
      );
      return { accessTokenTTL: 1800 };
    }

    console.log("[TokenExchange] Refreshing Google auth token...");
    const [token, err] = await refreshUpstreamAuthToken({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken: p.refreshToken,
      upstreamUrl: "https://oauth2.googleapis.com/token",
    });

    if (!token) {
      console.error(`[TokenExchange] Google refresh failed: ${err}`);
      throw new Error(`Google refresh failed: ${err}. Please re-authenticate.`);
    }

    console.log("[TokenExchange] Google token refresh successful.");

    return {
      newProps: {
        ...p,
        accessToken: token.access_token,
        expiresAt: now + token.expires_in,
        refreshToken: token.refresh_token || p.refreshToken,
      } satisfies Props,
      accessTokenTTL: 1800,
    };
  }
}
