import { GtmAuthProvider } from "../types/index.js";
import { createRefreshTokenAuth } from "./refreshTokenAuth.js";
import {
  createServiceAccountAuth,
  parseServiceAccountKey,
} from "./serviceAccountAuth.js";
import { createStaticTokenAuth } from "./staticTokenAuth.js";

export type GtmAuthEnv = {
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_IMPERSONATED_USER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_ACCESS_TOKEN?: string;
  GTM_SCOPES?: string;
};

export type GtmAuthMode =
  "service_account" | "refresh_token" | "access_token" | "unconfigured";

export const AUTH_ENV_HELP = [
  "No Google credentials configured. Set one of:",
  "  - GOOGLE_SERVICE_ACCOUNT_KEY (service account key JSON)",
  "  - GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (the same key, split in two)",
  "  - GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN",
  "  - GOOGLE_ACCESS_TOKEN (short lived, for debugging)",
].join("\n");

function parseScopes(scopes?: string): string[] | undefined {
  return scopes?.trim() ? scopes.split(/[\s,]+/).filter(Boolean) : undefined;
}

export function resolveAuthMode(env: GtmAuthEnv): GtmAuthMode {
  if (
    env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    (env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY)
  ) {
    return "service_account";
  }
  if (env.GOOGLE_REFRESH_TOKEN) {
    return "refresh_token";
  }
  if (env.GOOGLE_ACCESS_TOKEN) {
    return "access_token";
  }
  return "unconfigured";
}

export function createAuthFromEnv(env: GtmAuthEnv): GtmAuthProvider {
  const scopes = parseScopes(env.GTM_SCOPES);

  switch (resolveAuthMode(env)) {
    case "service_account": {
      const key = env.GOOGLE_SERVICE_ACCOUNT_KEY
        ? parseServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_KEY)
        : {
            clientEmail: env.GOOGLE_CLIENT_EMAIL as string,
            privateKey: env.GOOGLE_PRIVATE_KEY as string,
          };

      return createServiceAccountAuth({
        ...key,
        scopes,
        subject: env.GOOGLE_IMPERSONATED_USER,
      });
    }

    case "refresh_token": {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        throw new Error(
          "GOOGLE_REFRESH_TOKEN also requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        );
      }

      return createRefreshTokenAuth({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        refreshToken: env.GOOGLE_REFRESH_TOKEN as string,
      });
    }

    case "access_token":
      return createStaticTokenAuth({ accessToken: env.GOOGLE_ACCESS_TOKEN });

    default:
      throw new Error(AUTH_ENV_HELP);
  }
}
