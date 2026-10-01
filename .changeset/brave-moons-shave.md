---
"google-tag-manager-mcp-core": major
---

**Breaking:** migrate to the MCP TypeScript SDK v2 packages. The peer dependency changes from `@modelcontextprotocol/sdk` (`>=1.18.1 <2`) to `@modelcontextprotocol/server` (`^2.0.0`) — a different package name, so every consumer must install the v2 package and pass it a v2 `McpServer`. A v1 `McpServer` handed to `createGtmMcpServer()` / `registerGtmTools()` is a genuine type mismatch, not just an import-path rename, because the two SDKs' classes are unrelated.

All 18 tools now register through `registerTool(name, { description, inputSchema }, handler)` instead of the removed variadic `.tool()`, with schemas passed as `z.object(...)` rather than raw shapes. Tool names, descriptions, parameters and behavior are unchanged, but the advertised `inputSchema` in `tools/list` changes shape, as v2 emits JSON Schema 2020-12 via zod 4's own converter instead of v1's draft-07 conversion: `$schema` becomes `https://json-schema.org/draft/2020-12/schema`, `definitions` becomes `$defs`, `allOf: [{ $ref }]` wrappers collapse to a `$ref` with sibling keywords, and the `execution.taskSupport` member is gone (v2 removed the experimental tasks feature). Clients that pin or strictly validate the advertised schema shape need re-baselining; the new shapes are spec-conformant.

Requires `zod >=4.4.3` (unchanged) and Node.js 20+.
