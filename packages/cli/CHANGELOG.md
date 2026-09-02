# google-tag-manager-mcp-server

## 5.1.1

### Patch Changes

- 4110549: Fix write actions (create/update/delete) returning an empty `Google API Error <code> -` message instead of Google's actual error detail. The shared error formatter only read the legacy `error.errors[]` field from the old Google API client, which modern `@googleapis/tagmanager` errors don't populate; it now falls back to `error.message` so the real cause is surfaced.
- Updated dependencies [4110549]
- Updated dependencies [c7ae1fe]
  - google-tag-manager-mcp-core@2.1.1

## 5.1.0

### Minor Changes

- 6a85991: Fix `gtm_destination` crashing with `allItems.slice is not a function` when the Google API returns an empty object for a container with no linked Google Tags, and rename the tool to `gtag_destination` to reflect that it manages Google Tags (tagmanager.google.com/#/home#tags), not classic GTM container destinations. Also removed the `get`, `link`, and `unlink` actions: `get`/`link` are deprecated by Google and `unlink` was never part of the API; `list` is now the only supported action.

### Patch Changes

- Updated dependencies [6a85991]
  - google-tag-manager-mcp-core@2.1.0

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
