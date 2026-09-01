---
"google-tag-manager-mcp-core": patch
"google-tag-manager-mcp-server": patch
---

Fix write actions (create/update/delete) returning an empty `Google API Error <code> -` message instead of Google's actual error detail. The shared error formatter only read the legacy `error.errors[]` field from the old Google API client, which modern `@googleapis/tagmanager` errors don't populate; it now falls back to `error.message` so the real cause is surfaced.
