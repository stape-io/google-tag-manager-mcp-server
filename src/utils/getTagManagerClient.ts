import { google } from "googleapis";
import { log } from "./log";
import { AsyncLocalStorage } from "async_hooks";
import { OAuthController } from "../server/controllers/OAuthController";

type TagManagerClient = ReturnType<typeof google.tagmanager>;

// AsyncLocalStorage to store request context
export const requestContext = new AsyncLocalStorage<{ accessToken?: string }>();

// --- Helper function to obtain an authenticated TagManager client ---
export async function getTagManagerClient(
  scopes: string[],
): Promise<TagManagerClient> {
  try {
    let auth;

    // Priority 1: Use stored OAuth2 tokens from request context
    const context = requestContext.getStore();
    if (context?.accessToken) {
      const storedTokens = OAuthController.getStoredTokens(context.accessToken);
      if (storedTokens) {
        log("Using stored OAuth2 tokens for Tag Manager client");

        const oauth2Client = new google.auth.OAuth2(
          process.env.OAUTH_CLIENT_ID,
          process.env.OAUTH_CLIENT_SECRET,
        );

        oauth2Client.setCredentials({
          access_token: storedTokens.access_token,
          refresh_token: storedTokens.refresh_token,
        });

        auth = oauth2Client;
      }
    }
    // Priority 2: Use environment OAuth2 credentials
    else if (process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET) {
      log("Using environment OAuth2 authentication for Tag Manager client");

      const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET,
        process.env.OAUTH_REDIRECT_URI || "http://localhost:3000/auth/callback",
      );

      // Set credentials if refresh token is available
      if (process.env.GTM_REFRESH_TOKEN) {
        oauth2Client.setCredentials({
          refresh_token: process.env.GTM_REFRESH_TOKEN,
        });
      } else if (process.env.GTM_ACCESS_TOKEN) {
        oauth2Client.setCredentials({
          access_token: process.env.GTM_ACCESS_TOKEN,
        });
      } else {
        throw new Error(
          "OAuth2 credentials provided but no access token or refresh token found. " +
            "Please complete OAuth2 flow to obtain tokens.",
        );
      }

      auth = oauth2Client;
    }
    // Priority 2: Use service account authentication (fallback)
    else if (
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GTM_SERVICE_ACCOUNT_KEY_PATH
    ) {
      log("Using Service Account authentication for Tag Manager client");

      auth = new google.auth.GoogleAuth({
        scopes,
        keyFile:
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.GTM_SERVICE_ACCOUNT_KEY_PATH,
      });
    } else {
      throw new Error(
        "No authentication method configured. Please provide either:\n" +
          "1. Environment OAuth2 credentials (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, GTM_REFRESH_TOKEN)\n" +
          "2. Service Account key (GOOGLE_APPLICATION_CREDENTIALS or GTM_SERVICE_ACCOUNT_KEY_PATH)",
      );
    }

    return google.tagmanager({
      version: "v2",
      auth,
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
