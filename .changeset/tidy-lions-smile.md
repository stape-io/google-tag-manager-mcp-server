---
"google-tag-manager-mcp-core": patch
---

Document that `update` replaces the entire resource across all tools that support it (tag, trigger, client, container, environment, folder, Google tag config, transformation, container version, custom template, user permission, zone, workspace, account) — matching the warning `gtm_variable` already had. Callers, including AI agents, should always `get` the current object first and send back the complete thing with modifications applied, since any field left out is deleted.
