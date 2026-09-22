---
"gtm-mcp-worker": minor
---

The hosted `/mcp` route now negotiates MCP protocol revision **2026-07-28**.
It is served by the SDK v2 stateless HTTP entry (`createMcpHandler` from
`agents/mcp/server`, `agents` bumped to `^0.24.0`) instead of the SDK v1
`McpAgent.serve("/mcp")` Durable Object path. The grant is read from
`getMcpAuthContext()`, which the handler resolves from the `ctx.props`
`OAuthProvider` already attaches — no change to any OAuth endpoint, callback or
token wiring.

**Existing 2025-era clients keep working unchanged** on `/mcp`: claim-less
`initialize` traffic falls back to stateless legacy serving off the same tool
factory.

**`/sse` is untouched** and still runs on `McpAgent` / SDK v1, exactly as
before.

`gtm_remove_session` moves from the removed variadic `.tool()` to
`registerTool(name, { description }, handler)`. Name, description and behavior
are unchanged.
