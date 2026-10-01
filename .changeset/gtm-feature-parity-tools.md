---
"google-tag-manager-mcp-core": minor
"google-tag-manager-mcp-server": minor
---

New tools and actions:

- **`gtm_auth_status`** — diagnoses the configured Google credentials: whether a token can be obtained and is accepted, when it expires, and which Tag Manager scopes are granted or missing. Never returns the token.
- **`gtm_guide`** — GTM best-practice guidance as markdown by `topic`: `safeEditing`, `naming`, `audit`, `trackingPlan`, `consentMode`, `serverSide`.
- **`gtm_template` `importFromGallery`** — imports a Community Template Gallery template (`galleryOwner`, `galleryRepository`, optional `gallerySha`; requires `acknowledgePermissions: true`).
- **`gtm_workspace` `bulkUpdate`** — applies several entity changes atomically through the GTM API's `workspaces.bulk_update`. `changes` is a list of `{ changeStatus, entity }`; new entities use `new_N` temporary IDs that other changes in the same call can reference.

Fix: the `client` variant of `gtm_workspace`'s `entity` parameter (`resolveConflict`) was typed with the transformation schema; it now uses the client schema. The entity schema is emitted once under `$defs` (`GtmEntity`) and referenced from both `entity` and `changes[].entity`.

Fix: `gtm_workspace`'s `changeStatus` description for `resolveConflict` listed `'modified'`/`'unmodified'`, which the GTM API rejects; it now lists the real values `'added'`, `'updated'`, `'deleted'`, `'none'`.
