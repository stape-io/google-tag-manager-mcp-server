import { tagmanager } from "@googleapis/tagmanager";
import { GtmAuthProvider } from "../types/index.js";
import { log } from "./log.js";
import type { GtmInvocation } from "./createGtmRuntime.js";
import { getGtmRetryOptions } from "./gtmRequestPolicy.js";

export type TagManagerClient = ReturnType<typeof tagmanager>;

export async function getTagManagerClient(
  auth: GtmAuthProvider,
  invocation?: GtmInvocation,
): Promise<TagManagerClient> {
  try {
    const token = await auth.getAccessToken();

    return tagmanager({
      version: "v2",
      adapter: invocation?.adapter,
      signal: invocation?.signal,
      ...(invocation
        ? getGtmRetryOptions(Boolean(invocation.managesRetries))
        : {}),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
