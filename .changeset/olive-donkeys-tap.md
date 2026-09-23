---
"google-tag-manager-mcp-server": major
---

**Breaking:** the stdio server now negotiates MCP protocol revision **2026-07-28**, and migrates to the MCP TypeScript SDK v2 packages (`@modelcontextprotocol/server` `^2.0.0` replaces `@modelcontextprotocol/sdk`).

The entrypoint serves through `serveStdio()` instead of connecting an `McpServer` to a `StdioServerTransport` directly. The opening exchange now selects the era: a `server/discover` probe pins the connection to 2026-07-28, and 2026-era responses carry the new envelope (`resultType`, SEP-2549 `ttlMs`/`cacheScope` cache hints, and server identity in `_meta`). A bare `McpServer` + `StdioServerTransport` serves the 2025 era only no matter which SDK version it is built against, which is why this had to change rather than ride along with the dependency bump.

**Existing 2025-era clients keep working unchanged** — the legacy `initialize` handshake is still served and still negotiates the same protocol version as before. Requires Node.js 20+.
