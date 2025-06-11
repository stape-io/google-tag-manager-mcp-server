import { google } from "googleapis";
import { log } from "./log";

type TagManagerClient = ReturnType<typeof google.tagmanager>;

export async function getTagManagerClient(
  accessToken: string,
): Promise<TagManagerClient> {
  try {
    return google.tagmanager({
      version: "v2",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
