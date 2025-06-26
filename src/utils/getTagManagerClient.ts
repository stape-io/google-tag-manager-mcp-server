import { google } from "googleapis";
import { log } from "./log";

type TagManagerClient = ReturnType<typeof google.tagmanager>;

// --- Helper function to obtain an authenticated TagManager client ---
export async function getTagManagerClient(
  scopes: string[],
): Promise<TagManagerClient> {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes,
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });

    return google.tagmanager({
      version: "v2",
      auth,
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
