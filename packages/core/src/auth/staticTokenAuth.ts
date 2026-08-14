import { GtmAuthProvider } from "../types/index.js";
import { nowInSeconds } from "./tokenCache.js";

export type StaticTokenAuthConfig = {
  accessToken: string | undefined;
  /** Unix timestamp in seconds. */
  expiresAt?: number;
};

/**
 * Pass a function whenever the session's token can be refreshed while the
 * server runs: a provider built from a fixed value keeps serving the old one.
 */
export function createStaticTokenAuth(
  credentials: StaticTokenAuthConfig | (() => StaticTokenAuthConfig),
): GtmAuthProvider {
  return {
    async getAccessToken(): Promise<string> {
      const { accessToken, expiresAt } =
        typeof credentials === "function" ? credentials() : credentials;

      if (!accessToken) {
        throw new Error("Missing Google access token.");
      }

      if (expiresAt && nowInSeconds() >= expiresAt) {
        throw new Error(
          "Access token expired. Please refresh your connection or re-authenticate.",
        );
      }

      return accessToken;
    },
  };
}
