import { google } from "googleapis";
import { log } from "./log";

type TagManagerClient = ReturnType<typeof google.tagmanager>;

// --- Helper function to obtain an authenticated TagManager client ---
export async function getTagManagerClient(
  scopes: string[],
): Promise<TagManagerClient> {
  try {
    let auth;

    // Check if OAuth2 credentials are provided
    if (process.env.GTM_CLIENT_ID && process.env.GTM_CLIENT_SECRET) {
      log("Using OAuth2 authentication for Tag Manager client");
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GTM_CLIENT_ID,
        process.env.GTM_CLIENT_SECRET,
        process.env.GTM_REDIRECT_URI || 'http://localhost:3000/auth/callback'
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
          "Please complete OAuth2 flow to obtain tokens."
        );
      }

      auth = oauth2Client;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GTM_SERVICE_ACCOUNT_KEY_PATH) {
      log("Using Service Account authentication for Tag Manager client");
      
      auth = new google.auth.GoogleAuth({
        scopes,
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GTM_SERVICE_ACCOUNT_KEY_PATH,
      });
    } else {
      throw new Error(
        "No authentication method configured. Please provide either:\n" +
        "1. OAuth2 credentials (GTM_CLIENT_ID, GTM_CLIENT_SECRET, GTM_REFRESH_TOKEN)\n" +
        "2. Service Account key (GOOGLE_APPLICATION_CREDENTIALS or GTM_SERVICE_ACCOUNT_KEY_PATH)"
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
