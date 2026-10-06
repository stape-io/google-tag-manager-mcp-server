# google-tag-manager-mcp-core

## 3.0.0

### Major Changes

- 371f475: **Breaking:** migrate to the MCP TypeScript SDK v2 packages. The peer dependency changes from `@modelcontextprotocol/sdk` (`>=1.18.1 <2`) to `@modelcontextprotocol/server` (`^2.0.0`) — a different package name, so every consumer must install the v2 package and pass it a v2 `McpServer`. A v1 `McpServer` handed to `createGtmMcpServer()` / `registerGtmTools()` is a genuine type mismatch, not just an import-path rename, because the two SDKs' classes are unrelated.

  All 18 tools now register through `registerTool(name, { description, inputSchema }, handler)` instead of the removed variadic `.tool()`, with schemas passed as `z.object(...)` rather than raw shapes. Tool names, descriptions, parameters and behavior are unchanged, but the advertised `inputSchema` in `tools/list` changes shape, as v2 emits JSON Schema 2020-12 via zod 4's own converter instead of v1's draft-07 conversion: `$schema` becomes `https://json-schema.org/draft/2020-12/schema`, `definitions` becomes `$defs`, `allOf: [{ $ref }]` wrappers collapse to a `$ref` with sibling keywords, and the `execution.taskSupport` member is gone (v2 removed the experimental tasks feature). Clients that pin or strictly validate the advertised schema shape need re-baselining; the new shapes are spec-conformant.

  Requires `zod >=4.4.3` (unchanged) and Node.js 20+.

### Minor Changes

- 7620542: New tools and actions:

  - **`gtm_auth_status`** — diagnoses the configured Google credentials: whether a token can be obtained and is accepted, when it expires, and which Tag Manager scopes are granted or missing. Never returns the token.
  - **`gtm_guide`** — GTM best-practice guidance as markdown by `topic`: `safeEditing`, `naming`, `audit`, `trackingPlan`, `consentMode`, `serverSide`.
  - **`gtm_template` `importFromGallery`** — imports a Community Template Gallery template (`galleryOwner`, `galleryRepository`, optional `gallerySha`; requires `acknowledgePermissions: true`).
  - **`gtm_workspace` `bulkUpdate`** — applies several entity changes atomically through the GTM API's `workspaces.bulk_update`. `changes` is a list of `{ changeStatus, entity }`; new entities use `new_N` temporary IDs that other changes in the same call can reference.

  Fix: the `client` variant of `gtm_workspace`'s `entity` parameter (`resolveConflict`) was typed with the transformation schema; it now uses the client schema. The entity schema is emitted once under `$defs` (`GtmEntity`) and referenced from both `entity` and `changes[].entity`.

  Fix: `gtm_workspace`'s `changeStatus` description for `resolveConflict` listed `'modified'`/`'unmodified'`, which the GTM API rejects; it now lists the real values `'added'`, `'updated'`, `'deleted'`, `'none'`.

### Patch Changes

- 34a682f: Add an internal test suite (regression harness, golden `tools/list` snapshot, schema and dispatch invariants) with no behavior change. Also fixes `package.json`'s `files` field, which was unintentionally shipping the new `src/test` sources (including a `vitest` import) inside the published npm tarball.

## 2.1.1

### Patch Changes

- 4110549: Fix write actions (create/update/delete) returning an empty `Google API Error <code> -` message instead of Google's actual error detail. The shared error formatter only read the legacy `error.errors[]` field from the old Google API client, which modern `@googleapis/tagmanager` errors don't populate; it now falls back to `error.message` so the real cause is surfaced.
- c7ae1fe: Document that `update` replaces the entire resource across all tools that support it (tag, trigger, client, container, environment, folder, Google tag config, transformation, container version, custom template, user permission, zone, workspace, account) — matching the warning `gtm_variable` already had. Callers, including AI agents, should always `get` the current object first and send back the complete thing with modifications applied, since any field left out is deleted.

## 2.1.0

### Minor Changes

- 6a85991: Fix `gtm_destination` crashing with `allItems.slice is not a function` when the Google API returns an empty object for a container with no linked Google Tags, and rename the tool to `gtag_destination` to reflect that it manages Google Tags (tagmanager.google.com/#/home#tags), not classic GTM container destinations. Also removed the `get`, `link`, and `unlink` actions: `get`/`link` are deprecated by Google and `unlink` was never part of the API; `list` is now the only supported action.

## 2.0.0

### Major Changes

- b519712: Require zod v4. The `zod` peer dependency moves from `^3.22.4` to `^4.4.3`, so consumers passing their own schemas have to upgrade alongside.
