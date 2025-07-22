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
    
    // Priority 2: Use service account authentication (fallback)
    if (!auth && (
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GTM_SERVICE_ACCOUNT_KEY_PATH
    )) {
      log("Using Service Account authentication for Tag Manager client");

      auth = new google.auth.GoogleAuth({
        scopes,
        keyFile:
          process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.GTM_SERVICE_ACCOUNT_KEY_PATH,
      });
    }

    // If no authentication method is available, throw error
    if (!auth) {
      throw new Error(
        "Authentication required. Please ensure you have completed the OAuth2 authorization or configured a service account.",
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
