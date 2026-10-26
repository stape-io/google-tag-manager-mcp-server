---
"google-tag-manager-mcp-core": minor
"google-tag-manager-mcp-server": minor
---

Reuse bounded, credential-isolated snapshots for tag, trigger, and variable lists across numeric pages, coalesce concurrent scans, and add a fresh-read option. Invalidate snapshots around mutations and expose pluggable cache and usage adapters for hosted servers.

The hosted Worker shares snapshots through a separate Durable Object and records minimal Analytics Engine usage events. Caching is enabled in development and remains behind a production rollout switch.

The CLI enables list snapshots by default. Set `GTM_SNAPSHOT_CACHE_ENABLED=false` to disable them; GTM UI edits can otherwise remain invisible until snapshot expiry unless `fresh: true` is requested.

Add opt-in shared request scheduling, bounded quota retries and cancellation. Prevent duplicate scans after cache delivery failures or timeouts, and avoid replaying uncertain writes when scheduling is enabled.
