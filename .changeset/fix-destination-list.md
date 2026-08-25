---
"google-tag-manager-mcp-core": patch
---

Fix `gtm_destination` list failing with "allItems.slice is not a function". The list response is an object with a `destination` array, not an array itself, so the destinations are now read from `response.data.destination`.
