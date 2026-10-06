---
name: google-tag-manager
description: Use when working with Google Tag Manager through the Stape GTM MCP server (tools named gtm_*) - auditing a container, adding or changing tags, triggers, variables or templates, planning tracking, setting up Consent Mode or server-side tagging, or publishing a container version.
---

# Google Tag Manager via the Stape GTM MCP server

Setup: hosted at `https://gtm-mcp.stape.ai/mcp` (Google OAuth in the browser), or locally with `npx -y google-tag-manager-mcp-server` and your own credentials. See the [README](https://github.com/stape-io/google-tag-manager-mcp-server#readme).

## How the tools are shaped

One tool per GTM resource, with an `action` parameter: `gtm_account`, `gtm_container`, `gtm_workspace`, `gtm_tag`, `gtm_trigger`, `gtm_variable`, `gtm_built_in_variable`, `gtm_folder`, `gtm_template`, `gtm_client`, `gtm_transformation`, `gtm_zone`, `gtm_environment`, `gtm_version`, `gtm_version_header`, `gtm_gtag_config`, `gtag_destination`, `gtm_user_permission`. Plus `gtm_guide` (best-practice guidance) and `gtm_auth_status` (credential diagnostics).

Navigate top-down: `gtm_account` list → `gtm_container` list → `gtm_workspace` list → entities in that workspace.

## Rules

1. **Read the guide first.** Call `gtm_guide` with the topic that matches the task (`safeEditing`, `naming`, `audit`, `trackingPlan`, `consentMode`, `serverSide`) before planning changes.
2. **Updates replace the whole entity.** Always `get` first, apply the change to the full object, and send it back with its `fingerprint`. Anything omitted is deleted.
3. **Work in a workspace, never live.** Check with `gtm_workspace` `getStatus` and `quickPreview` before creating a version.
4. **Related changes go together.** Use `gtm_workspace` `bulkUpdate` (temporary IDs `new_1`, `new_2`, ...) so a tag and its new trigger land atomically.
5. **Prefer gallery templates over Custom HTML.** `gtm_template` `importFromGallery` needs `acknowledgePermissions: true` — show the user the permissions the template requests and get consent first.
6. **Publishing and deleting need explicit user confirmation.** `gtm_version` `publish` changes live traffic; `remove` actions are destructive.
7. **Auth errors:** on a 401/403 call `gtm_auth_status`. It shows whether the token works, when it expires and which scopes are missing.
8. **Large lists paginate.** Follow `pagination.nextPage`; for versions use `resourceType` to page through one resource type at a time.
