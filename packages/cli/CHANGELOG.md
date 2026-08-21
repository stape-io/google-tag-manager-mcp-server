# google-tag-manager-mcp-server

## 5.0.0

### Major Changes

- b519712: Require zod v4. The `zod` peer dependency moves from `^3.22.4` to `^4.4.3`, so consumers passing their own schemas have to upgrade alongside.

### Patch Changes

- Updated dependencies [b519712]
  - google-tag-manager-mcp-core@2.0.0

## 4.0.0

### Major Changes

- cd33be4: The npm package is a working local MCP server again.

  Since 2.0.0 the published `bin` pointed at the Cloudflare Worker entry point, which has no shebang and no stdio transport, so `npx google-tag-manager-mcp-server` did nothing. It now starts a real MCP server over stdio, built on `google-tag-manager-mcp-core`.

  Credentials come from the environment — a service account key, an OAuth refresh token, or an access token. The hosted server at `gtm-mcp.stape.ai` is unaffected and still handles Google OAuth for you.
