# Hosted GTM MCP snapshots

The HTTP and SSE handlers use `GtmReadCache` through the `GTM_READ_CACHE` Durable Object binding when `GTM_SNAPSHOT_CACHE_ENABLED` is `true`. Each object belongs to one Google user and configured Google OAuth client. Its entries are further isolated by MCP client, credential, and resource path.

Snapshots and pending scans live in memory. Eviction causes a cache miss; no Google credential or snapshot is written to Durable Object storage. The default lifetime and retention limits are defined in [`listSnapshotCache.ts`](../../packages/core/src/utils/listSnapshotCache.ts). Account-side edits and permission changes can remain invisible until expiry; `fresh: true` bypasses stored snapshots. Mutation invalidation is deliberately conservative: it clears every snapshot for that Google user and OAuth configuration, across MCP clients.

The default and `io` environments disable caching; `dev` enables it. Setting `GTM_SNAPSHOT_CACHE_ENABLED` to `false` bypasses the hosted cache while preserving usage events. An enabled environment requires the `GTM_READ_CACHE` binding and the `GtmReadCache` migration in [`wrangler.jsonc`](wrangler.jsonc).

## Usage events

The optional `GTM_USAGE` Analytics Engine binding receives events from both the API handler and cache object. Dataset names belong to each deployment environment in `wrangler.jsonc`.

| Field            | Meaning                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------ |
| `index1`         | Tool name, used as the sampling key                                                        |
| `blob1`          | Event: `tool_call`, `google_attempt`, `snapshot`, `snapshot_wait`, or `invalidation_error` |
| `blob2`, `blob3` | Tool and action                                                                            |
| `blob4`          | Snapshot result: `hit`, `miss`, `coalesced`, or `bypass`                                   |
| `blob5`          | Quota category: `daily`, `rate`, `unknown`, or `none`                                      |
| `blob6`          | Random correlation ID for the tool invocation                                              |
| `double1`        | Event count                                                                                |
| `double2`        | HTTP status; zero for network failures or non-HTTP events                                  |
| `double3`        | Duration in milliseconds                                                                   |
| `double4`        | Attempt number for the upstream request, including SDK retries                             |

Use the [Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) and weight aggregates by `_sample_interval`. Group `google_attempt` counts and `tool_call` counts by tool/action to calculate average Google attempts per MCP call. Group `snapshot` events by result to measure cache effectiveness. `snapshot_wait` records a caller waiting for an existing scan; it is separate from the completed snapshot result.

Only the scan owner records the Google attempts of a coalesced fill. Cache hits record no Google attempt. Quota categories are diagnostic; Google Cloud quota metrics remain authoritative for daily project consumption. Known daily failures are not retried during snapshot fills. Transient list failures use bounded SDK retries.

Telemetry contains no authorization headers, tokens, emails, Google user IDs, MCP client IDs, resource paths, or GTM payloads. An Analytics Engine delivery failure does not fail a Google operation. A cache invalidation delivery failure after a mutation records `invalidation_error`; the existing mutation lease suppresses caching until it expires. Cache failures before a mutation prevent the Google request from starting.

## Verification

From the repository root:

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run smoke
npx wrangler deploy --dry-run --cwd apps/worker
```

Tests use the real MCP dispatch and a fake Google transport. Hosted adapter tests keep one cache object across independent HTTP requests. Live OAuth, the Cloudflare binding, Analytics Engine ingestion, and SSE need a development deployment to verify.
