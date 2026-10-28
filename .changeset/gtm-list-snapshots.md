---
"google-tag-manager-mcp-core": minor
"google-tag-manager-mcp-server": minor
---

Cache complete tag, trigger, and variable lists across numeric pages for 30 seconds, with credential/resource isolation and bounded retention. Add `fresh: true` to bypass cached and shared reads, and invalidate snapshots around mutations. Core-library factories, direct tool registration, and the CLI enable caching by default. CLI users can set `GTM_SNAPSHOT_CACHE_ENABLED=false`; embedders can pass `runtime: createGtmRuntime({ enabled: false })` to opt out or supply cache backends and usage observers.

Add opt-in request scheduling with paced Google attempts, bounded quota retries, and cancellation. The CLI accepts `GTM_REQUEST_SCHEDULER_ENABLED=true`; a local scheduler coordinates one process. Supplied cache backends must configure their own scheduler. Scheduled lists have a five-minute total budget, with up to 25 seconds per upstream request including queueing and retries; ordinary calls retain a 25-second total budget. Unscheduled reads retain normal caller and transport limits.

Allow custom tools to select a list or single-operation budget explicitly. Reuse complete snapshots across automatic replacements while preserving fresh-read and mutation barriers. Document client timeout configuration for long lists.

Forward MCP cancellation to in-flight Google requests for all core action tools, including when scheduling is disabled.

Require Node.js 20.3 or newer.
