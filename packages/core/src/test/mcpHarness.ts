import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createGtmMcpServer,
  CreateGtmMcpServerOptions,
} from "../createGtmMcpServer.js";
import { GtmAuthProvider } from "../types/index.js";

export interface McpHarnessOptions {
  /** Defaults to a stub returning a fixed dummy token - no real Google credentials. */
  auth?: GtmAuthProvider;
  /** Passed through to createGtmMcpServer(); defaults to the production tool set. */
  tools?: CreateGtmMcpServerOptions["tools"];
}

export interface McpHarness {
  /** Real MCP Client, already connected and initialized against the real server. */
  client: Client;
  /** Closes both ends of the in-memory transport pair. */
  close: () => Promise<void>;
}

const stubAuth: GtmAuthProvider = {
  getAccessToken: async () => "test-access-token",
};

/**
 * Spins up a real McpServer (via the project's own createGtmMcpServer(), exactly as
 * production wires it) connected to a real Client over the SDK's in-memory transport
 * pair, and performs the client-side initialize handshake. Intended for tests that need
 * to exercise the actual SDK registration/dispatch path - no mocking of the SDK itself.
 */
export async function createHarness({
  auth = stubAuth,
  tools,
}: McpHarnessOptions = {}): Promise<McpHarness> {
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
