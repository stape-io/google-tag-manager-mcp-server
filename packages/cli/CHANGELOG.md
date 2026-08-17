# google-tag-manager-mcp-server

## 4.0.0

### Major Changes

- cd33be4: The npm package is a working local MCP server again.

  Since 2.0.0 the published `bin` pointed at the Cloudflare Worker entry point, which has no shebang and no stdio transport, so `npx google-tag-manager-mcp-server` did nothing. It now starts a real MCP server over stdio, built on `google-tag-manager-mcp-core`.

  Credentials come from the environment — a service account key, an OAuth refresh token, or an access token. The hosted server at `gtm-mcp.stape.ai` is unaffected and still handles Google OAuth for you.
