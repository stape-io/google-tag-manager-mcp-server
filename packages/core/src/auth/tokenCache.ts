export type FetchedToken = {
  accessToken: string;
  expiresInSeconds?: number;
};

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function createCachedTokenSource(
  fetchToken: () => Promise<FetchedToken>,
  { expirySkewSeconds = 60 }: { expirySkewSeconds?: number } = {},
): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;
  let inFlight: Promise<string> | null = null;

  return async () => {
    if (cached && cached.expiresAt - expirySkewSeconds > nowInSeconds()) {
      return cached.token;
    }

    if (!inFlight) {
      inFlight = fetchToken()
        .then(({ accessToken, expiresInSeconds }) => {
          cached = {
            token: accessToken,
            expiresAt: nowInSeconds() + (expiresInSeconds ?? 3600),
          };
          return accessToken;
        })
        .finally(() => {
          inFlight = null;
        });
    }

    return inFlight;
  };
}

type TokenEndpointResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function requestGoogleToken(
  tokenUrl: string,
  params: Record<string, string>,
): Promise<FetchedToken> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  const body = (await response
    .json()
    .catch(() => null)) as TokenEndpointResponse | null;

  if (!response.ok || !body?.access_token) {
    const detail =
      [body?.error, body?.error_description].filter(Boolean).join(": ") ||
      `HTTP ${response.status}`;
    throw new Error(`Google token request failed: ${detail}`);
  }

  return {
    accessToken: body.access_token,
    expiresInSeconds: body.expires_in,
  };
}
