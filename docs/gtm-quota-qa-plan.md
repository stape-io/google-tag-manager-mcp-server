# GTM MCP verification

This guide covers local verification and live checks for list caching, request
scheduling and quota retries. Local tests use fake Google responses; OAuth,
Google quota behavior and Analytics Engine ingestion require a deployment.

Matching changes merged to `main` trigger the `.ai` production deployment,
including Durable Object migrations and the Analytics Engine binding even when
feature flags are disabled. See the [production rollout](gtm-production-rollout.md)
for readiness checks, static quota allocation and rollback.

## Local verification

Run from the repository root:

```sh
npm ci
npm run check:versions
npm run test:tooling
npm run build
npm run typecheck
npm run lint -- --max-warnings=0
npm test --ignore-scripts
npm run smoke
npm run test:station
npx changeset status --since=origin/main
npx wrangler deploy --dry-run --cwd apps/worker --env=''
npx wrangler deploy --dry-run --cwd apps/worker --env dev
npx wrangler deploy --dry-run --cwd apps/worker --env io
```

The explicit build prepares fixtures for `npm test --ignore-scripts`. Running
`npm test` normally builds them through its lifecycle script. Worker bundle dry
runs do not deploy or prove account provisioning or telemetry ingestion.

The local station starts loopback fake Google HTTP and local Wrangler servers
with real Durable Objects. It exercises MCP calls, then shuts down both servers
and removes temporary storage. Its dedicated configuration has no production
routes or cloud resources; its entry point is not imported by the deployed Worker.
It records upstream methods, paths and timestamps using fake credentials.

Station scenarios cover multi-page lists, snapshot sharing across HTTP requests,
Google-user isolation, mutation invalidation, concurrent users sharing a quota
project, temporary quota recovery, non-retryable daily/permission failures,
ambiguous writes, cancellation and delayed coordinator delivery. The accelerated
station interval is for local testing only; use the approved project quota when
configuring a deployment.

## Live configuration

Use a non-production deployment and a disposable GTM workspace. Do not publish a
container. Keep account identifiers, credentials and raw diagnostics out of
public reports; publish only a sanitized verification summary.

1. Verify the reviewed revision, cache/coordinator bindings and migrations, and
   the `GTM_USAGE` Analytics Engine binding in the target account.
2. Match the Google OAuth client to the project that owns its quota. Set
   `GTM_QUOTA_PROJECT_ID` to that verified project ID and set
   `GTM_REQUEST_INTERVAL_MS` from the approved rate and daily limits, allowing for
   other consumers. Separate deployments require a combined allocation or one
   shared coordinator; identical project keys do not join separate namespaces.
3. Enable `GTM_REQUEST_SCHEDULER_ENABLED=true` and
   `GTM_SNAPSHOT_CACHE_ENABLED=true` for combined testing. Use the
   [Worker configuration reference](../apps/worker/README.md) for defaults,
   telemetry fields and client timeouts.
4. Complete OAuth and verify modern HTTP and legacy SSE where used. Reconnect
   retained SSE sessions after configuration changes. Check MCP token refresh
   and upstream Google refresh separately; see the
   [known sign-out limitation](gtm-production-rollout.md#known-issue-oauth-sign-out-and-refresh).

## Live scenarios

| Area                   | Check                                                                                          | Expected result                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Pagination             | Read tag, trigger and variable lists across multiple numeric pages.                            | Exact totals and page boundaries; subsequent pages reuse the complete snapshot.                                                               |
| Cache reuse            | Repeat a list with the same credentials, user, client and resource.                            | A snapshot hit has no associated Google attempt.                                                                                              |
| Fresh reads and expiry | Request `fresh: true`, wait for expiry, and make an external edit in the disposable workspace. | Fresh reads bypass stored and in-flight results; ordinary reads observe external changes after expiry. Reads do not extend snapshot lifetime. |
| Isolation              | Read the same resource as different Google users, MCP clients and credentials.                 | No snapshot data crosses isolation boundaries.                                                                                                |
| Invalidation           | Create, update and remove disposable tags, triggers and variables.                             | Subsequent lists reflect mutations without duplicate writes; do not publish the container.                                                    |
| Concurrency            | Send a small bounded set of reads from multiple users sharing a quota project.                 | Actual Google attempts follow the approved pacing; cache hits use no permit.                                                                  |
| Cancellation           | Cancel a queued read, then cancel one of two readers sharing a scan.                           | Remaining readers can finish; the producer stops when its last reader leaves. An already executed Google operation cannot be undone.          |
| Telemetry              | Inspect Google attempts, cache results, queue wait/rejection/cancellation and retry events.    | Sampling-weighted events explain behavior without tokens, user/resource identifiers or GTM payloads.                                          |
| Latency and saturation | Exercise a large scan, queue saturation and a slow response.                                   | Errors stay within operation budgets; failed or partial scans are not cached and do not start fallback scans.                                 |
| Feature switches       | Disable cache and scheduling separately in the isolated test deployment.                       | Cache bypass and unscheduled behavior match their documented settings. Do not remove production pacing as a quota-error workaround.           |

Compare Analytics Engine diagnostics with Google Cloud's authoritative project
quota metrics. Distinguish local queue rejection from upstream rate/daily quota
errors. Do not deliberately exhaust production quota to verify retry behavior;
use local fake responses for deterministic failure cases.

## Limits

Scheduled ordinary operations have a 25-second total budget; scheduled lists
have five-minute reader budgets and a separate fixed five-minute shared producer
budget. Each upstream request has at most 25 seconds including queueing,
execution and retries, clipped to the remaining operation budget. A reader can
join a producer with less time remaining than its own budget. Partial results
are not resumable or cached, and a near-deadline permit does not guarantee enough
time to finish Google execution. Client timeouts and cancellation can end a call
earlier. Without scheduling, normal caller/transport limits apply.

Active scans admit readers while pages complete within the inactivity window;
scheduled scans also need enough remaining producer time. Automatic replacement
scans can share their first complete result. Fresh reads and mutation/clear
invalidation establish separate families, so old results cannot cross those
barriers. See the [Worker README](../apps/worker/README.md) for timing details.

Hosted cancellation leaves reserved slots unused until their time passes. Expired
permits cannot authorize Google requests; repeated delivery or timer delays can
consume pacing capacity without useful work. Increasing the pending limit alone
does not extend request deadlines. The coordinator persists timing reservations,
not credentials or payloads.

Mutation invalidation covers all MCP clients sharing the same Google-user/OAuth
cache object. A lost mutation-end message can suppress caching until its lease
expires. If invalidation cannot be delivered, old snapshots can remain visible
until expiry. External edits and permission changes also require expiry or a
fresh read. Use separate backends for unrelated embedder tenants.

Daily quota, permission failures and ambiguous writes are not retried. Eligible
temporary failures use bounded retries, with every Google attempt acquiring a
permit. The scheduler has no daily counter. The CLI coordinates one process;
other deployments or applications can still consume the same Google quota.
