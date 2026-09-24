import { afterEach, beforeEach, vi } from "vitest";
import { createHarness, McpHarness } from "./mcpHarness.js";
import { GtmAuthProvider } from "../types/index.js";

export const TEST_TOKEN = "secret-test-token";
export const TEST_WORKSPACE_PATH = "accounts/1/containers/2/workspaces/3";

export type FetchCall = { url: string; method: string; body: string };

export interface GoogleApiStub {
  /** Every request made during the current test, in order. */
  readonly calls: FetchCall[];
  /** Answers each request. Reset to `200 {}` before every test. */
  respond: (call: FetchCall) => Response;
  /** Calls a tool on a fresh harness whose auth returns TEST_TOKEN by default. */
  callTool(
    name: string,
    args: Record<string, unknown>,
    auth?: GtmAuthProvider,
  ): Promise<{ isError?: boolean; text: string }>;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// googleapis' HTTP layer (gaxios) only uses `window.fetch` when `window`
// exists and otherwise falls back to `node-fetch`, caching that choice for the
// process. A delegating `window.fetch` routes its calls to the stubbed global
// `fetch`, so no test using this stub can reach the real network.
const windowShim = {
  fetch: (...args: Parameters<typeof fetch>): Promise<Response> =>
    globalThis.fetch(...args),
};

/**
 * Stubs every outbound HTTP request (Google APIs and plain `fetch`) for the
 * calling test file. Call once at the top level of a test file: it registers
 * its own beforeEach/afterEach hooks.
 */
export function useGoogleApiStub(): GoogleApiStub {
  let harness: McpHarness | undefined;

  const stub: GoogleApiStub = {
    calls: [],
    respond: () => json({}),
    async callTool(name, args, auth) {
      harness = await createHarness({
        auth: auth ?? {
          getAccessToken: async (): Promise<string> => TEST_TOKEN,
        },
      });
      const result = await harness.client.callTool({ name, arguments: args });
      return {
        isError: result.isError as boolean | undefined,
        text: (result.content as { text: string }[])[0].text,
      };
    },
  };

  beforeEach(() => {
    stub.calls.length = 0;
    stub.respond = (): Response => json({});
    vi.stubGlobal("window", windowShim);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const call = {
          url: request.url,
          method: request.method,
          body: await request.text(),
        };
        stub.calls.push(call);
        return stub.respond(call);
      }),
    );
  });

  afterEach(async () => {
    await harness?.close();
    harness = undefined;
    vi.unstubAllGlobals();
  });

  return stub;
}
