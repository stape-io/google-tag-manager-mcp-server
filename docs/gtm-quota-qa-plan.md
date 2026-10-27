# GTM quota work: local verification and QA handoff

Tracking: [DEV-13529](https://stape.atlassian.net/browse/DEV-13529),
[DEV-13235](https://stape.atlassian.net/browse/DEV-13235),
[PR #99](https://github.com/stape-io/google-tag-manager-mcp-server/pull/99).

Goal: tested locally and ready for QA testing by October 30, 2026.
**Before merge:** the release workflow on `main` targets `.ai` production,
including migrations and Analytics Engine even with feature flags disabled. QA
must validate the branch before merge; disabled flags do not prevent deployment.

Deployment, QA execution, and real-Google smoke testing belong to the QA coworker,
per the user's October 26 clarification.

## Implementation

- Tracking task created with acceptance criteria; implementation extends PR #99.
- Existing snapshot caching, fresh reads, pagination and mutation invalidation remain covered.
- All ordinary GTM calls, snapshot pages and retry attempts acquire scheduling permits.
- Hosted coordination is shared by project across users and persisted across object recreation.
- With scheduling enabled, queue length, total attempt time and retries are bounded. SDK retries do not nest around the scheduler.
- Temporary quota rejections use backoff and jitter. Daily exhaustion, permission failures and ambiguous writes do not retry.
- Cache delivery failures and timeouts return errors instead of launching duplicate scans.
- SDK cancellation reaches ordinary calls; explicit per-call cancellation crosses the cache-object hop.
- Shared scans continue for remaining readers and abort when every reader leaves.
- Queue wait/rejection and retry events use the existing telemetry columns without credentials or user/resource data.

## Local station

Run from the repository root:

```sh
npm ci
npm run test:station
```

The command builds and typechecks the local entry point, starts a loopback fake
Google HTTP server and local Wrangler with real Durable Objects, exercises MCP
HTTP calls, then shuts down both servers and removes its temporary storage.
It records upstream methods, paths and timestamps using fake credentials.
The dedicated configuration has no production routes or cloud resources.
The local-only entry point is never imported by the deployed Worker.

Station scenarios cover multi-page lists, cache sharing across HTTP requests,
Google-user isolation, mutation invalidation, concurrent users sharing a quota
project, temporary 403 recovery with backoff, daily/permission failure handling,
an ambiguous delete outcome and cancellation through the real cache-object hop.
The station uses a 100ms test interval; production defaults are tested with fake
time, not by consuming real Google quota.

## Local evidence — October 26, 2026

The baseline build and existing tests passed at PR revision
`f1520d7764eb2fca237e081589bba5dcdc4ca4f3` before changes.

Regression evidence:

- The cache-timeout test first failed with two Google scans instead of one;
  it now passes with no fallback scan.
- Scheduled write tests exposed an outer SDK retry despite `retry: false`;
  explicit retry-configuration suppression fixed duplicate update/delete attempts.
- Real local Wrangler cancellation initially left two Google pages running
  after abort. An explicit cancel operation fixed that failure.

Deterministic tests additionally cover FIFO order, default 25-per-100-second
pacing, saturation, deadline expiry, stopped coordinators, cancellation capacity,
partial/shared scan behavior, quota retry accounting, Retry-After exceeding the
budget, coordinator recreation stale-permit expiry and delivery latency exceeding the permit interval.

Verification commands:

```sh
npm run build
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run smoke
npm run test:station
npx changeset status --since=origin/main
npx wrangler deploy --dry-run --cwd apps/worker --env=''
npx wrangler deploy --dry-run --cwd apps/worker --env dev
npx wrangler deploy --dry-run --cwd apps/worker --env io
```

Final test counts and check results are recorded in the PR description. Bundle
dry runs do not deploy or prove cloud provisioning. No real Google call or
container publish is part of local verification.

## QA configuration and scenarios

1. Deploy the reviewed revision to QA with the v3 `GtmRequestCoordinator`
   migration and `GTM_REQUEST_COORDINATOR` binding. Verify the pre-existing
   cache binding/migration and Analytics Engine dataset as well.
2. Set `GTM_REQUEST_SCHEDULER_ENABLED=true` and `GTM_QUOTA_PROJECT_ID` to the
   actual Google Cloud quota project. Confirm the project's approved rate and
   daily limits; use `GTM_REQUEST_INTERVAL_MS` to match the rate. The default is
   4100ms. Do not copy the station's 100ms interval into QA by assumption.
3. Enable `GTM_SNAPSHOT_CACHE_ENABLED=true` for combined testing. Test real
   OAuth authentication and refresh over modern HTTP and legacy SSE.
4. Read tag/trigger/variable lists over multiple MCP pages. Check exact totals,
   reuse of a snapshot, `fresh: true`, expiry and changes made externally in GTM.
5. Run concurrent users on the same project. Verify pacing of actual Google
   attempts and that cached data remains isolated by user/client/credential.
6. In a disposable workspace, create/update/remove test entities without
   publishing a container. Verify invalidation and no duplicate entities.
7. Cancel a waiting read and repeat it; also cancel one of two shared readers.
   Remaining readers should succeed and abandoned queued scans should stop.
8. Check `google_attempt`, `queue_wait`, `queue_rejected`, `retry_wait` and
   snapshot events in Analytics Engine. Compare sampling-weighted counts and
   error categories with Google Cloud metrics. Inspect for sensitive data.
9. Check client experience on a large scan, queue saturation and a slow Google
   response. Errors must be bounded and must not cause a second scan or write.
10. Disable scheduling and verify the rollout switch. Production scheduling
    remains disabled; the existing production cache switches also remain disabled.

## Limits and follow-ups

- With scheduling enabled, readers have independent 25-second budgets. Shared scans have a separate fixed
  25-second producer cap, including pagination, scheduling and backoff. A sufficiently large/slow scan can return a deadline
  error; partial results are never cached. QA must assess this against real
  container sizes and the project's approved quota.
- Cancellation cannot undo an already executed Google operation. If the cancel
  control message is lost, the producer deadline still bounds scheduled scans.
  Without scheduling, caller/transport limits apply; enabling caching does not
  add an operation timeout.
- Cancelled hosted reservations remain unused until their slot passes. Only
  timing reservations are persisted; there are no durable background jobs.
- Separate deployments/Cloudflare accounts have independent coordinators. They
  must use separate Google quota projects or one central shared coordinator
  before enabling both against the same project. The CLI coordinates one
  process only; other applications consuming quota can still cause rejections.
- Batching, cursor/lazy pagination, dashboards and production enablement are
  outside this change. Real-Google behavior and cloud telemetry ingestion remain
  QA responsibilities, not claims established by local tests.

## Review follow-up verification

The review fixes add regression coverage for immediately rejoining a cancelled
fill with scheduling on/off; cancellation stopping pagination without scheduling;
independent reader deadlines; delayed mutation starts/replies, including legacy
backend IDs; defensive snapshot/page copies; exact UTF-8 budget boundaries;
preserved Google quota errors; distinct cancellation metrics; and latency-aware,
bounded permit renewal. The real Worker station also runs a 100ms permit interval
with 200ms coordinator delivery delay. Core caching remains on by default by
explicit user decision, with the opt-out documented in the core README.

Subprocess fixtures rebuild automatically before tests. Retry suppression and
quota classification are declared on Google clients rather than changed by the
adapter. Exact byte accounting is retained while avoiding a second full-array
serialization allocation. Validation uses local fakes only; real-Google testing
and deployment remain QA responsibilities.

Prior follow-up (`de2dbfa`) results: 197 tests pass (92 Worker and 105 core), including 15
cache review regressions and the coordinator latency/renewal cases. Build,
typecheck, zero-warning lint, both CLI protocol smoke tests, the real local
Worker station with delayed coordinator delivery, changeset validation, and
all three Worker bundle dry runs pass. Late mutation replies are tested both
before and after the Google write finishes; they neither release an active
write's lease early nor invalidate fresh data after an already completed lease.
These are local verification results; GitHub CI status is reported separately.

## Second review follow-up — October 27, 2026

The scheduling-off path preserves normal read timing whether caching is on or
off, including hosted cache reads beyond 30 seconds. Explicit subscriber deadlines
and cancellation still apply. Scheduling-on call/producer limits remain bounded.
Coordinator delivery timing is captured before waiting for a reserved slot;
long queues and late wake-ups no longer become spurious network-delay estimates.

Deadline/admission failures retain the preceding upstream network/quota failure
as cause and message context. Last-reader cleanup preserves deadline reasons,
so timeouts do not count as user cancellations. Retry option selection is shared,
and CI skips redundant lifecycle builds after its explicit fixture build.
Standalone local test commands retain automatic fixture builds.

The retry guard is retained and tested through both public request overrides.
The exported full-snapshot API and backend-ID compatibility are preserved. Only
the redundant mutation-clear fallback was removed; late backend-ID cleanup
continues to have regression coverage. These fixes perform no QA or production
deployment.

Local verification: 208 tests pass (93 Worker and 115 core). Build, typecheck,
zero-warning lint, both CLI protocol smoke tests, the real local Worker station
with delayed coordinator delivery, changeset validation, and all three Worker
bundle dry runs pass. The CI test invocation runs all tests without repeating
the preceding build. Real-Google testing remains assigned to QA.
