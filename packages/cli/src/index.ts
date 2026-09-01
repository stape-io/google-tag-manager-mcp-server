#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  createAuthFromEnv,
  createGtmMcpServer,
  resolveAuthMode,
  setLogSink,
} from "google-tag-manager-mcp-core";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

// stdout carries the JSON-RPC stream, so every log line has to go to stderr.
setLogSink((message, ...rest) => console.error(message, ...rest));

async function main(): Promise<void> {
  const server = createGtmMcpServer({
    auth: createAuthFromEnv(process.env),
    serverInfo: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
  });

  await server.connect(new StdioServerTransport());

  console.error(
    `[${PACKAGE_NAME}] v${PACKAGE_VERSION} ready on stdio (auth: ${resolveAuthMode(process.env)})`,
  );
}

main().catch((error: unknown) => {
  console.error(
    `[${PACKAGE_NAME}] failed to start:\n${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
