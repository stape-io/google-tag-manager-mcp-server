# google-tag-manager-mcp-core

## 2.1.0

### Minor Changes

- 6a85991: Fix `gtm_destination` crashing with `allItems.slice is not a function` when the Google API returns an empty object for a container with no linked Google Tags, and rename the tool to `gtag_destination` to reflect that it manages Google Tags (tagmanager.google.com/#/home#tags), not classic GTM container destinations. Also removed the `get`, `link`, and `unlink` actions: `get`/`link` are deprecated by Google and `unlink` was never part of the API; `list` is now the only supported action.

## 2.0.0

### Major Changes

- b519712: Require zod v4. The `zod` peer dependency moves from `^3.22.4` to `^4.4.3`, so consumers passing their own schemas have to upgrade alongside.
