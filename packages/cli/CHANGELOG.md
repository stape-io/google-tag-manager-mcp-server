# google-tag-manager-mcp-server

## 6.0.0

### Major Changes

- 371f475: **Breaking:** the stdio server now negotiates MCP protocol revision **2026-07-28**, and migrates to the MCP TypeScript SDK v2 packages (`@modelcontextprotocol/server` `^2.0.0` replaces `@modelcontextprotocol/sdk`).

  The entrypoint serves through `serveStdio()` instead of connecting an `McpServer` to a `StdioServerTransport` directly. The opening exchange now selects the era: a `server/discover` probe pins the connection to 2026-07-28, and 2026-era responses carry the new envelope (`resultType`, SEP-2549 `ttlMs`/`cacheScope` cache hints, and server identity in `_meta`). A bare `McpServer` + `StdioServerTransport` serves the 2025 era only no matter which SDK version it is built against, which is why this had to change rather than ride along with the dependency bump.

  **Existing 2025-era clients keep working unchanged** — the legacy `initialize` handshake is still served and still negotiates the same protocol version as before. Requires Node.js 20+.

### Minor Changes

- 7620542: New tools and actions:

  - **`gtm_auth_status`** — diagnoses the configured Google credentials: whether a token can be obtained and is accepted, when it expires, and which Tag Manager scopes are granted or missing. Never returns the token.
  - **`gtm_guide`** — GTM best-practice guidance as markdown by `topic`: `safeEditing`, `naming`, `audit`, `trackingPlan`, `consentMode`, `serverSide`.
  - **`gtm_template` `importFromGallery`** — imports a Community Template Gallery template (`galleryOwner`, `galleryRepository`, optional `gallerySha`; requires `acknowledgePermissions: true`).
  - **`gtm_workspace` `bulkUpdate`** — applies several entity changes atomically through the GTM API's `workspaces.bulk_update`. `changes` is a list of `{ changeStatus, entity }`; new entities use `new_N` temporary IDs that other changes in the same call can reference.

  Fix: the `client` variant of `gtm_workspace`'s `entity` parameter (`resolveConflict`) was typed with the transformation schema; it now uses the client schema. The entity schema is emitted once under `$defs` (`GtmEntity`) and referenced from both `entity` and `changes[].entity`.

  Fix: `gtm_workspace`'s `changeStatus` description for `resolveConflict` listed `'modified'`/`'unmodified'`, which the GTM API rejects; it now lists the real values `'added'`, `'updated'`, `'deleted'`, `'none'`.

### Patch Changes

- Updated dependencies [371f475]
- Updated dependencies [7620542]
- Updated dependencies [34a682f]
  - google-tag-manager-mcp-core@3.0.0

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
