import type { tagmanager_v2 } from "@googleapis/tagmanager";
import { gtmRetryConfig } from "./gtmTelemetry.js";

/** folders.entities is a read operation exposed by Google over POST. */
export function isGtmReadOnlyRequest(method: string, url: URL): boolean {
  const verb = method.toUpperCase();
  return (
    verb === "GET" ||
    verb === "HEAD" ||
    (verb === "POST" && url.pathname.endsWith(":entities"))
  );
}

/** Configure at client construction, before gaxios prepares any request. */
export const GTM_NO_RETRY_CONFIG = {
  retry: 0,
  shouldRetry: (): boolean => false,
};

type RetryOptions = Pick<
  ConstructorParameters<typeof tagmanager_v2.Tagmanager>[0],
  "retry" | "retryConfig"
>;

export function getGtmRetryOptions(managed: boolean): RetryOptions {
  return managed
    ? { retry: false, retryConfig: { ...GTM_NO_RETRY_CONFIG } }
    : { retryConfig: gtmRetryConfig };
}
