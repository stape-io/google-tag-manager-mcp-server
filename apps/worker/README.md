# Hosted GTM MCP snapshots

The HTTP and SSE handlers use `GtmReadCache` through the `GTM_READ_CACHE` Durable Object binding when `GTM_SNAPSHOT_CACHE_ENABLED` is `true`. Each object belongs to one Google user and configured Google OAuth client. Its entries are further isolated by MCP client, credential, and resource path.

Snapshots and pending scans live in memory. Eviction causes a cache miss; no Google credential or snapshot is written to Durable Object storage. When the object is unreachable, or its read deadline expires with scheduling enabled, list reads return an error. A failed or timed-out cache delivery does not trigger a fallback scan. Completed pages refresh a 30-second inactivity window for sharing a scan. After 30 seconds without a completed page, later readers can start a replacement while existing readers continue waiting. Scheduled scans also stop admitting new readers when less than 25 seconds remains in their producer budget. Automatic replacements can reuse the first completed result in their active scan family and stop redundant pagination. Fresh reads and mutation/clear invalidation establish separate families; older scans cannot supply those results or overwrite newer snapshots. Cancellation of redundant scans after successful reuse does not count as user queue cancellation. The object returns only the requested page and exact totals to the Worker, including on cache hits. The default lifetime and retention limits are defined in [`listSnapshotCache.ts`](../../packages/core/src/utils/listSnapshotCache.ts). Account-side edits and permission changes can remain invisible until expiry; `fresh: true` bypasses stored snapshots. Mutation invalidation is deliberately conservative: it clears every snapshot for that Google user and OAuth configuration, across MCP clients.

The default and `io` environments disable caching; `dev` enables it. Setting `GTM_SNAPSHOT_CACHE_ENABLED` to `false` bypasses the hosted cache while preserving usage events. An enabled environment requires the `GTM_READ_CACHE` binding and the `GtmReadCache` migration in [`wrangler.jsonc`](wrangler.jsonc).

A merge to `main` triggers the [.ai production deployment](../../.github/workflows/release.yml). The Durable Object migration and Analytics Engine binding deploy with caching disabled; usage events are active independently of the cache flag. Production accounts require Analytics Engine to be enabled. Bundle dry runs validate configuration and bundling, but do not verify account provisioning or ingestion. The `.io` production deployment is selected explicitly in the release workflow.

## Usage events

The optional `GTM_USAGE` Analytics Engine binding receives events from both the API handler and cache object. Dataset names belong to each deployment environment in `wrangler.jsonc`.

| Field            | Meaning                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index1`         | Tool name, used as the sampling key                                                                                                                         |
| `blob1`          | Event: `tool_call`, `google_attempt`, `snapshot`, `snapshot_wait`, `invalidation_error`, `queue_wait`, `queue_rejected`, `queue_cancelled`, or `retry_wait` |
| `blob2`, `blob3` | Tool and action                                                                                                                                             |
| `blob4`          | Snapshot result: `hit`, `miss`, `coalesced`, or `bypass`                                                                                                    |
| `blob5`          | Quota category: `daily`, `rate`, `unknown`, or `none`                                                                                                       |
| `blob6`          | Random correlation ID for the tool invocation                                                                                                               |
| `double1`        | Event count                                                                                                                                                 |
| `double2`        | HTTP status; zero for network failures or non-HTTP events                                                                                                   |
| `double3`        | Duration in milliseconds                                                                                                                                    |
| `double4`        | Attempt number for the upstream request, including retries                                                                                                  |

Use the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) and weight aggregates by `_sample_interval`. Group `google_attempt` counts and `tool_call` counts by tool/action to calculate average Google attempts per MCP call. Group `snapshot` events by result to measure cache effectiveness. `snapshot_wait` records a caller waiting for an existing scan; it is separate from the completed snapshot result.

Only the scan owner records the Google attempts of a coalesced fill. Cache hits record no Google attempt. Quota categories are diagnostic; Google Cloud quota metrics remain authoritative for daily project consumption. Known daily failures are not retried by instrumented GTM calls, including snapshot fills. With scheduling enabled, eligible failures use one bounded retry loop; every attempt re-enters the scheduler. With scheduling disabled, list reads retain the existing bounded SDK retry policy.

Telemetry contains no authorization headers, tokens, emails, Google user IDs, MCP client IDs, resource paths, or GTM payloads. An Analytics Engine delivery failure does not fail a Google operation. Cache control operations and sign-out cache clearing have bounded waits. Invalidation failures record `invalidation_error` and Google writes continue; a post-write failure does not turn a successful Google operation into a retry. An existing mutation lease suppresses caching until it expires. If invalidation cannot be delivered, previously cached data can remain visible until normal snapshot expiry. Grant revocation does not depend on cache clearing succeeding.

## Verification

From the repository root:

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run smoke
npx wrangler deploy --dry-run --cwd apps/worker --env=""
npx wrangler deploy --dry-run --cwd apps/worker --env dev
npx wrangler deploy --dry-run --cwd apps/worker --env io
```

Tests use the real MCP dispatch and a fake Google transport. Hosted adapter tests keep one cache object across independent HTTP requests. Live OAuth, the Cloudflare binding, Analytics Engine ingestion, and SSE need a development deployment to verify.

## Shared project scheduling

Set `GTM_REQUEST_SCHEDULER_ENABLED=true` and `GTM_QUOTA_PROJECT_ID` to the actual
Google Cloud project that owns the quota. The `GTM_REQUEST_COORDINATOR` binding
and v3 migration are included in every environment; scheduling remains disabled
in all deployment configurations until QA/rollout configuration is supplied.
All users and OAuth clients in this deployment sharing a project must use the
same coordinator namespace and project key. Independent deployments have
independent namespaces: they must use separate Google quota projects or share
one central coordinator before both enable scheduling for the same project.

`GTM_REQUEST_INTERVAL_MS` defaults to 4100 milliseconds and
`GTM_REQUEST_MAX_PENDING` defaults to an upper bound of 25 future reservations, subject to the stricter per-request deadline. At the default 4100ms pacing and 25-second request budget, deadline admission binds before a depth of 25; raising the capacity alone has no effect. Lower limits or faster approved pacing can make capacity bind. Set the interval
from the actual approved project quota. The coordinator persists only its next
reservation timestamp, never tokens, payloads, or identifiers. Cancelled slots
are left unused until their scheduled time; caller cancellation never executes
work in the coordinator. Old permits expire so suspended callers must requeue. If delivery latency exceeds a permit's validity, the next reservation is placed ahead of measured round-trip latency without widening the validity window. Renewal is capped at three attempts. Delivery latency is measured before waiting for a reserved slot, so queue time and late timer wake-ups do not inflate the delivery estimate.

Ordinary calls, cache misses, every Google pagination page, and retries all
acquire permits; cache hits do not. With scheduling enabled, ordinary calls have a 25-second total budget and list readers have five-minute budgets. A shared scan has a separate fixed
five-minute producer budget. Each upstream request, including queueing and retries, has up to 25 seconds, clipped to the remaining operation budget. The external cache read guard allows 305 seconds, including delivery. Clients must allow enough request time to benefit from longer lists; cancellation still applies. Long scans can therefore return a deadline
error; failed/partial scans are not cached. Backoff uses exponential delay plus
jitter and honors `Retry-After` within the deadline. Explicit temporary quota
rejections can retry. Reads can also retry transient network/408/5xx failures;
writes are never replayed after ambiguous network/408/5xx outcomes. Daily quota,
permission, and unclassified 403 failures stop immediately.

`queue_wait` measures permit wait, `queue_rejected` records failed admission,
`queue_cancelled` separates caller cancellation from rejected admission,
and `retry_wait` records backoff duration, attempt, status and quota category in
the existing Analytics Engine columns. They are separate from `google_attempt`.
Cancellation crosses the cache-object hop as an explicit per-call message,
because a subrequest abort alone does not reliably cancel object work. Shared
scans continue until all readers cancel. If that control message cannot be
delivered, scheduled scans still have a producer deadline. Without scheduling,
normal caller/transport limits apply; caching does not impose a new operation
timeout.

Run `npm run test:station` from the root for the isolated local Worker station.
See [the QA handoff](../../docs/gtm-quota-qa-plan.md) for checks and responsibilities.

Mutation starts carry a caller-generated lease ID. Ends invalidate the cache and
remember completed IDs briefly, so delayed starts cannot reactivate ended leases.
For external backends that generate their own IDs, late successful starts receive
bounded cleanup. Snapshot byte accounting uses per-entity UTF-8 sizes with early
rejection above the byte cap rather than allocating a second full-snapshot string.

QA must run against the reviewed branch before merge. Merging into `main`
triggers the `.ai` production deployment workflow, including both new object
migrations and the Analytics Engine binding even with caching/scheduling disabled.
Feature flags are not a deployment gate. The `.io` deployment remains explicit.

Deadline failures retain the preceding upstream network/quota error as cause
and message context when available. The deadline or admission error remains the
primary failure. Explicit user cancellation is reported separately; a reader
expiring does not turn into a user-cancellation metric.

Coordinator transport failures and unreadable response bodies return a consistent unavailable message. Structured queue-full/deadline responses and caller cancellation retain their specific errors. Internal delivery errors remain available as causes rather than in user-facing messages. Sign-out retains its own one-second cache-clear boundary even though the standard runtime also bounds clearing.

For clients using the MCP TypeScript SDK, configure `callTool(..., { timeout: 310_000 })` when a list may need the five-minute budget. The SDK default is 60 seconds; the server cannot extend client timeouts. See the core README for a complete example and the explicit `startCall` operation-kind option for custom tool handlers. Individual Google requests remain capped at 25 seconds.

Mutation leases suppress cache reuse across every MCP client sharing the same
Google-user/OAuth cache object. This is intentional: writes change shared Google
resources. A delivered mutation start with a lost end can bypass caching for the
whole object until the lease expires (up to 120 seconds), even when no write is
still running.

Delivery lead time helps avoid expired permits after slow RPC delivery. It does
not compensate for persistent local timer lateness: if a future slot dominates
`now + leadMs`, a late wake can miss all three bounded attempts. Those expired
reservations issue no Google requests, but consume pacing capacity. At the
default interval, three misses consume three 4.1-second slots. Slots are not
rewound or reclaimed, since later callers may already hold reservations. Any
future reclamation must atomically prove last-reservation ownership; widening
permit validity or blindly changing `max` would weaken pacing safety.
