import { GTM_LIST_DEADLINE_MS } from "./gtmScheduledAdapter.js";

export const GTM_CACHE_CONTROL_TIMEOUT_MS = 1_000;
// Allow the list producer budget plus delivery time across the backend hop.
export const GTM_CACHE_READ_TIMEOUT_MS = GTM_LIST_DEADLINE_MS + 5_000;

export class GtmCacheTimeoutError extends Error {}

export async function withGtmCacheTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = GTM_CACHE_CONTROL_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new GtmCacheTimeoutError("GTM snapshot cache timed out.")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
