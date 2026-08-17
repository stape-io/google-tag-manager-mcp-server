import { tagmanager } from "@googleapis/tagmanager";
import { GtmAuthProvider } from "../types/index.js";
import { log } from "./log.js";

export type TagManagerClient = ReturnType<typeof tagmanager>;

export async function getTagManagerClient(
  auth: GtmAuthProvider,
): Promise<TagManagerClient> {
  try {
    const token = await auth.getAccessToken();

    return tagmanager({
      version: "v2",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
