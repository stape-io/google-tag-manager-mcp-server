import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  createGtmMcpServer,
  CreateGtmMcpServerOptions,
} from "../createGtmMcpServer.js";
import { GtmAuthProvider } from "../types/index.js";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
// Never actually dialed - the modern-era transport's `fetch` is overridden to
// call the in-process handler directly (see below).
const IN_PROCESS_URL = new URL("http://mcp-harness.invalid/mcp");

export interface McpHarnessOptions {
  /** Defaults to a stub returning a fixed dummy token - no real Google credentials. */
  auth?: GtmAuthProvider;
  /** Passed through to createGtmMcpServer(); defaults to the production tool set. */
  tools?: CreateGtmMcpServerOptions["tools"];
  /**
   * Protocol era the harness's Client negotiates.
   * - "legacy" (default): plain 2025 `initialize` handshake, no version negotiation.
   * - "modern": pins version negotiation to revision 2026-07-28.
   */
  era?: "legacy" | "modern";
}

export interface McpHarness {
  /** Real MCP Client, already connected and initialized against the real server. */
  client: Client;
  /** Closes both ends of the transport pair. */
  close: () => Promise<void>;
}

const stubAuth: GtmAuthProvider = {
  getAccessToken: async () => "test-access-token",
};

/**
 * Spins up a real McpServer (via the project's own createGtmMcpServer(), exactly as
 * production wires it) connected to a real Client, and performs the client-side
 * initialize handshake. Intended for tests that need to exercise the actual SDK
 * registration/dispatch path - no mocking of the SDK itself.
 *
 * The legacy era connects a bare McpServer directly over the SDK's in-memory
 * transport pair. The modern era can't do that: a hand-wired McpServer+transport
 * pair only ever negotiates the 2025 handshake - the `server/discover` bootstrap
 * probe is only classified and pinned by the SDK's own serving entries
 * (`createMcpHandler` on HTTP, `serveStdio` on stdio; see the same finding
 * documented in apps/worker/src/mcpHandler.ts). So the modern era is driven over
 * `createMcpHandler` - exactly what production's `/mcp` route uses - via a
 * `StreamableHTTPClientTransport` whose `fetch` is overridden to call that
 * handler in-process. No real network is involved.
 */
export async function createHarness({
  auth = stubAuth,
  tools,
  era = "legacy",
}: McpHarnessOptions = {}): Promise<McpHarness> {
  if (era === "modern") {
    const handler = createMcpHandler(() => createGtmMcpServer({ auth, tools }));
    const client = new Client(
      { name: "mcp-harness-client", version: "0.0.0-test" },
      { versionNegotiation: { mode: { pin: MODERN_PROTOCOL_VERSION } } },
    );
    const transport = new StreamableHTTPClientTransport(IN_PROCESS_URL, {
      fetch: (input, init) => handler.fetch(new Request(input, init)),
    });

    await client.connect(transport);

    return {
      client,
      close: async (): Promise<void> => {
        try {
          await client.close();
        } finally {
          await handler.close();
        }
      },
    };
  }

  const server = createGtmMcpServer({ auth, tools });
  const client = new Client({
    name: "mcp-harness-client",
    version: "0.0.0-test",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    close: async (): Promise<void> => {
      try {
        await client.close();
      } finally {
        await server.close();
      }
    },
  };
}
