import { tagmanager } from "@googleapis/tagmanager";
import { GtmAuthProvider } from "../types/index.js";
import { log } from "./log.js";
import type { GtmInvocation } from "./createGtmRuntime.js";
import { GTM_NO_RETRY_CONFIG } from "./gtmRequestPolicy.js";
import { gtmRetryConfig } from "./gtmTelemetry.js";

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
        ? {
            retryConfig: invocation.managesRetries
              ? GTM_NO_RETRY_CONFIG
              : gtmRetryConfig,
          }
        : {}),
      ...(invocation?.managesRetries ? { retry: false } : {}),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    log("Error creating Tag Manager client:", error);
    throw error;
  }
}
