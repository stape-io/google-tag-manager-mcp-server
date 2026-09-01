import { GOOGLE_TOKEN_URL } from "../constants/scopes.js";
import { GtmAuthProvider } from "../types/index.js";
import { createCachedTokenSource, requestGoogleToken } from "./tokenCache.js";

export type RefreshTokenAuthConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenUrl?: string;
};

export function createRefreshTokenAuth(
  config: RefreshTokenAuthConfig,
): GtmAuthProvider {
  const { clientId, clientSecret, refreshToken } = config;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Refresh token auth requires clientId, clientSecret and refreshToken.",
    );
  }

  const getAccessToken = createCachedTokenSource(() =>
    requestGoogleToken(config.tokenUrl ?? GOOGLE_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  );

  return { getAccessToken };
}
