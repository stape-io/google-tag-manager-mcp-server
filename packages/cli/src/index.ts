#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  createAuthFromEnv,
  createGtmMcpServer,
  resolveAuthMode,
  setLogSink,
} from "google-tag-manager-mcp-core";
import { PACKAGE_NAME, PACKAGE_VERSION } from "./version.js";

// stdout carries the JSON-RPC stream, so every log line has to go to stderr.
setLogSink((message, ...rest) => console.error(message, ...rest));

function main(): void {
  // Resolved eagerly, before any connection: an unconfigured credential set has
  // to fail the process at startup rather than lazily inside the factory below,
  // where a client would only see it as a failed opening.
  const auth = createAuthFromEnv(process.env);

  // serveStdio owns the era decision for the connection: the opening exchange
  // selects protocol revision 2026-07-28 (a `server/discover` probe) or the
  // 2025-era `initialize` handshake, and pins ONE instance from this factory for
  // the connection's lifetime. A bare `server.connect(new StdioServerTransport())`
  // would serve the 2025 era only, whatever SDK version it is built against.
  serveStdio(() =>
    createGtmMcpServer({
      auth,
      serverInfo: { name: PACKAGE_NAME, version: PACKAGE_VERSION },
    }),
  );

  console.error(
    `[${PACKAGE_NAME}] v${PACKAGE_VERSION} ready on stdio (auth: ${resolveAuthMode(process.env)})`,
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(
    `[${PACKAGE_NAME}] failed to start:\n${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}
