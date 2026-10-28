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
   response. Errors must be bounded and must not cause an automatic fallback scan or replay an ambiguous write. New readers may replace a scan after 30 seconds without a completed page, or when less than 25 seconds remains in its scheduled producer budget. Configure client request timeouts to accommodate the five-minute list budget.
10. Disable scheduling and verify the rollout switch. Production scheduling
    remains disabled; the existing production cache switches also remain disabled.

## Limits and follow-ups

- With scheduling enabled, ordinary calls have a 25-second budget and list readers have independent five-minute budgets. Shared scans have a separate fixed
  five-minute producer cap. Each upstream request has up to 25 seconds for queueing, execution and retries, clipped to the remaining operation budget. A sufficiently large/slow scan can return a deadline
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

## Third review follow-up — October 27, 2026

A scan now accepts new subscribers while pages complete within 30 seconds.
Later readers replace an inactive scan; page progress refreshes the window.
Scheduled scans also require at least 25 seconds of remaining producer budget. Existing subscribers retain their normal
caller/transport limits; unscheduled producers gain no operation timeout. Old
scan completion and cancellation cannot delete a replacement fill or overwrite
its cached result. `fresh: true` continues to bypass in-flight scans immediately.

Supplied backends own upstream execution. The core README now shows explicitly
passing the same scheduler and observer to both `ListSnapshotCache` and
`createGtmRuntime`. Hosted Durable Objects already configure their scheduler
independently. Regression coverage exercises pagination, quota retries, ordinary
calls, and cache hits with the documented supplied-cache configuration.

Contributor notes belong here rather than in the published package README:
`npm test` rebuilds core and CLI fixtures, including when invoked in the core
workspace. CI builds once and then uses `npm test --ignore-scripts` to skip
redundant lifecycle builds. The full-snapshot API, backend-generated mutation-ID
compatibility, and public retry guard remain supported.

Local verification: 212 tests pass (93 Worker and 119 core), including four new
regressions for hung-scan recovery, old/new completion ordering, and supplied-cache
scheduling. Build, typecheck, zero-warning lint, both CLI protocol smoke tests,
the real local Worker station, changeset validation, all three Worker bundle dry
runs, and npm package-content/README organization checks pass. No real-Google
requests or deployments were performed.

## Fourth review follow-up — October 27, 2026

The approved scheduling policy gives list operations a five-minute total budget
and ordinary operations 25 seconds. Each Google request has at most 25 seconds
including queueing and retries, bounded by the remaining operation budget. This
covers cached lists, cache bypass, folders and version headers. Shared producers
remain capped at five minutes; partial results are not cached. Hosted read guards
allow 305 seconds. Client/transport cancellation may end an operation earlier.

Completed pages refresh scan admission for 30 seconds, avoiding duplicate healthy
slow scans. Scheduled fills with less than 25 seconds left stop admitting readers.
Automatic replacement families can reuse their first completed result; fresh reads and mutation/clear invalidation remain separate barriers. Stale cleanup cannot delete a different active fill.
Finite budgets still limit very large lists; there is no resumable partial scan.

Local admission predicts FIFO timing and rejects slots at/beyond the caller's
deadline immediately. Predictions exclude cancelled work and work that will
expire before its slot. Rejected requests reserve no capacity. Future cancellation
can make later admission possible. Near-deadline permits may still leave little
execution time; there is no minimum Google execution allowance.

Coordinator delivery and body-decoding failures return the unavailable message;
structured admission errors and caller cancellation retain their meanings. The
outer sign-out timeout is retained, as is the public retry override guard.
The changeset describes final public release behavior rather than review history
or private Worker rollout details.

Local verification: 230 tests pass (102 Worker and 128 core), including 18 new
cases covering deadline-aware local admission, cancellation capacity, progressing
scan sharing, eight-page lists at default pacing, folder/version-header paging,
the exact 25-second remaining-budget admission boundary, hosted lists beyond
30 seconds, normalized coordinator failures, and preserved cancellation/queue
errors. The producer-cap regression still verifies a hard five-minute limit.
Build, typecheck, zero-warning lint, both CLI protocol smoke tests, the real local
Worker station, changeset validation, npm package checks, and all three Worker
bundle dry runs pass. No deployment or real-Google testing was performed.

## Fifth review follow-up — October 28, 2026

The core README includes a connected TypeScript SDK client example using
`callTool(..., { timeout: 310_000 })`. Its default 60-second timeout can end a
large list early; server deadlines cannot extend it. Cancellation still stops a
sole reader's producer, and partial lists are never cached.

Automatic replacements in the same active family can consume whichever complete
scan finishes first. That result is cached, redundant pagination is aborted, and
reused results report `coalesced`. Already-started Google requests cannot be
undone. Fresh reads and mutation/clear invalidation create separate families;
no old-family result crosses those barriers. An individual scan's failure or
cancellation does not fail a live replacement. Internal successful reuse does not
count as user queue cancellation.

`GtmRuntime.startCall` accepts an optional fifth argument with
`operationKind: "list" | "single"`. Custom actions, including `extraTools`, can
select the five-minute operation budget without naming the action `list`.
Omission preserves existing action-based defaults. The per-request queue,
execution and retry budget remains 25 seconds in all cases; the sign-out timeout
and retry override guard remain unchanged.

Local verification: 244 tests pass (103 Worker and 141 core), including 14 new
cases for the real SDK's default/extended client timeout, explicit custom-tool
operation kinds, both automatic completion orders, scheduled near-deadline reuse,
fresh/mutation/clear barriers, scan failure/cancellation isolation, and reuse
across hosted stateless requests. Build, typecheck, zero-warning lint, both CLI
protocol smoke tests, the real local Worker station, changeset validation, npm
package checks, and all three Worker bundle dry runs pass. The 25-second request
budget, outer sign-out timeout, and retry override guard are unchanged. No
deployment or real-Google testing was performed.

## Review follow-up — October 28, 2026

Core and CLI default caching is explicit in the release note. Core documentation
now explains backend-wide invalidation, tenant/backend boundaries, cross-MCP-client
lease scope, and the 120-second fallback after a lost mutation end. Cross-client
invalidation remains intentional; container combine/move operations can affect
resources outside the request path. Cancellation propagation without scheduling
is explicit in the release note.

The capacity limit is an upper bound: the 25-second per-request budget dominates
at default pacing. Persistent late timer wakes can miss all three permits even
with a loaded coordinator; the regression pins reservations at 8.2, 12.3 and
16.4 seconds with 1.2-second timer lateness. No Google attempt is authorized by
those expired permits. Capacity reclamation is a separate protocol change and
is not implemented; permit validity and pacing safety remain unchanged.

Scheduler defaults are shared by core, CLI, and Worker. Test suites are named by
subject. Root tests prepare fixtures once, while standalone core tests still
rebuild them. Generated version sources are checked before CI builds and
regenerated after release-version bumps. The core/CLI Node 20.3 compatibility job
is separate from Node 24 repository/Worker checks; repository tooling needs 22+.

Local verification: 247 workspace tests pass (104 Worker and 143 core), plus
the tooling regression for non-mutating version checks and regeneration. Normal
root tests and standalone core tests each build core/CLI fixtures once; the CI
test command adds no builds. All 143 core tests and both CLI protocol smoke tests
also pass on Node 20.3.0. Version-source checks, typecheck, zero-warning lint,
the real local Worker station, changeset validation, and all three Worker bundle
dry runs pass. No deployment or real-Google testing was performed.
