---
"google-tag-manager-mcp-core": minor
---

Reuse bounded, credential-isolated snapshots for tag, trigger, and variable lists across numeric pages, coalesce concurrent scans, and add a fresh-read option. Invalidate snapshots around mutations and expose pluggable cache and usage adapters for hosted servers.

The hosted Worker shares snapshots through a separate Durable Object and records minimal Analytics Engine usage events. Caching is enabled in development and remains behind a production rollout switch.
