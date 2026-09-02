# google-tag-manager-mcp-core

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
