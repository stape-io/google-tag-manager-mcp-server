# GTM MCP production rollout

This runbook covers production Analytics Engine readiness, snapshot caching and
request scheduling for `gtm-mcp.stape.ai` and `gtm-mcp.stape.io`. The release owner
needs access to both production Cloudflare accounts and the Google Cloud project
that owns the production OAuth client. Verify account readiness and event ingestion
in each target account before enabling features; local bundle checks do not prove
cloud provisioning.

Do not publish a GTM container during these checks. Use an approved test workspace
and read-only calls. The [sign-out limitation](#known-issue-oauth-sign-out-and-refresh)
applies independently of cache and scheduler enablement.

## Configuration and deployment targets

Inspect the current settings from the repository root:

```sh
cat apps/worker/wrangler.jsonc
cat .github/workflows/release.yml
cat packages/core/src/utils/gtmRequestScheduler.ts
```

The default Wrangler environment targets `.ai`; `env.io` targets `.io`. They
reside in different Cloudflare accounts. Both release targets load the same
production Google OAuth client. Their Durable Object namespaces, OAuth stores
and Analytics Engine datasets are separate. The `dev` environment has its own
configuration and must not be used as a source of production credentials.

The `Release to Production` workflow automatically deploys `.ai` when a matching
change reaches `main`. Binding and migration changes deploy even with cache and
scheduler flags disabled. `.io` requires an
explicit workflow dispatch. Manual dispatch accepts `ai`, `io` or `both`; it has
no feature-flag inputs. `both` runs the deployments sequentially, not atomically.

Keep both production feature flags disabled for the initial deployment. Later
enablement belongs in a reviewed configuration change to
[`wrangler.jsonc`](../apps/worker/wrangler.jsonc), with the same revision selected
for both production targets. Preserve unrelated variables and secrets. Dashboard
overrides can be overwritten by a later Wrangler deployment; do not rely on them
as the persistent configuration. Environment variables are
[not inherited by named environments](https://developers.cloudflare.com/workers/configuration/environment-variables/).

## Before merge: owner checks

- [ ] Record the reviewed commit and confirm its required CI checks pass.
- [ ] Confirm the release credentials can deploy the Worker, its Durable Object
      migrations and the Analytics Engine binding in each production account.
- [ ] Confirm Analytics Engine is available in both accounts and identify a
      person who can query each account's dataset after deployment.
- [ ] Match the deployed Google OAuth client to its owning project. Verify the
      project ID, project number, approved rate limit, daily limit, current daily
      usage and reset boundary in Google Cloud. Keep account identifiers and raw
      diagnostics in a restricted release record; use the verified production
      project ID for configuration.
- [ ] Inventory every other application or deployment using that project's GTM
      quota, including CLIs. Reserve capacity for their usage before allocating
      the two hosted budgets.
- [ ] Confirm the initial production configuration leaves both feature flags
      disabled and acknowledge that merge still triggers the `.ai` deployment.
- [ ] Name the release owner, observation window and person responsible for
      reducing traffic or rolling back if checks fail.

## Initial deployment: verify telemetry before enabling features

1. After the authorized merge and automatic `.ai` deployment, inspect the deployed
   revision, `GTM_USAGE`, `GTM_READ_CACHE`, `GTM_REQUEST_COORDINATOR` and their
   migrations. Dispatch the release workflow for `.io` at the same reviewed
   revision, then perform the same checks there.
2. Read each environment's `GTM_USAGE` dataset name from `wrangler.jsonc` and match
   the deployed binding in the corresponding Cloudflare account. A dataset need
   not exist before its first write: Analytics Engine
   [creates it automatically](https://developers.cloudflare.com/analytics/analytics-engine/get-started/).
3. Complete OAuth on each host and make a small read-only Google call, such as
   `gtm_workspace` with action `get` in the approved workspace. Confirm both the
   response and new `tool_call` / `google_attempt` events. Authentication alone
   does not prove Google access or telemetry ingestion.
4. Query through the account's Analytics Engine interface or SQL API. The SQL API
   needs an account-scoped `Account Analytics Read` token; that read permission
   is separate from Worker writes through the binding. Never put a token in the
   PR, logs or this document. A `403` from the reader does not itself prove that
   Worker ingestion is broken.
5. Record the account, dataset, deployed revision, UTC test interval and query
   result for each host in the restricted release record. Pause feature
   enablement if ingestion cannot be checked.
   Worker request/CPU metrics alone do not prove Analytics Engine ingestion.

For each account, substitute its configured dataset identifier in this query:

```sql
SELECT
  blob1 AS event,
  blob4 AS cache_result,
  blob5 AS quota_kind,
  double2 AS status,
  SUM(_sample_interval * double1) AS event_count
FROM <DATASET_FROM_WRANGLER>
WHERE timestamp >= NOW() - INTERVAL '15' MINUTE
GROUP BY blob1, blob4, blob5, double2
ORDER BY event_count DESC
```

The [`Usage events` reference](../apps/worker/README.md#usage-events) defines the
columns. Sampling-weighted aggregates help diagnose behavior; Google Cloud quota
metrics remain authoritative for total project consumption. Query both accounts
over the same UTC interval and combine their results when assessing production.

## Enable cache first

Set `GTM_SNAPSHOT_CACHE_ENABLED` to the string `"true"` in the default `vars`,
deploy `.ai` and verify it before repeating in `env.io.vars` and deploying `.io`.
Keep scheduling disabled during this stage. Cache alone does not limit traffic.

Read the same tag, trigger or variable list twice using the same user/client,
arguments and credentials within the snapshot lifetime. Confirm the repeated
read reports `snapshot` / `hit` without an associated `google_attempt`; use
`blob6` to correlate events for the same tool call. A `fresh: true` read must
issue Google work rather than reuse the stored snapshot. Verify through modern
HTTP and legacy SSE where those transports are used. Do not edit or publish a
production container to exercise invalidation; see the
[verification guide](gtm-quota-qa-plan.md) for disposable-workspace mutation scenarios.

Record cache hit/miss/coalesced/bypass counts, Google attempts per tool call and
errors before progressing. Existing SSE sessions may retain their previous
runtime configuration; reconnect them and verify the new behavior.

## Allocate a static budget before enabling both schedulers

Separate namespaces do not form one scheduler. `GTM_QUOTA_PROJECT_ID` selects an
object inside each namespace; it does not change Google's quota attribution or
join the two queues. Use the verified production project ID on both hosts, but
allocate their combined traffic explicitly. Unused capacity on one host is not
automatically available to the other.

The following is a proposed starting allocation only when the owner confirms a
project limit of at least 25 requests per 100 seconds, a daily limit of at least
20,000, and enough remaining capacity after other consumers:

| Target   | `GTM_REQUEST_INTERVAL_MS` | Nominal requests per 100 seconds |
| -------- | ------------------------- | -------------------------------- |
| `.ai`    | `10000`                   | 10                               |
| `.io`    | `10000`                   | 10                               |
| Combined | independent queues        | 20                               |

This leaves nominal headroom for the sliding-window boundary, permit delivery
timing and other traffic. The spare capacity is not a separate enforceable
allocation for uncontrolled consumers. Google's
[GTM quota policy](https://developers.google.com/tag-platform/tag-manager/api/v2/limits-quotas)
applies to the project as a whole. Do not enable both independent deployments at
the single-deployment default interval.

For other quotas or an unequal allocation, calculate nominal consumption as:

```text
requests per window = window_ms / ai_interval_ms + window_ms / io_interval_ms
requests per day = 86400000 / ai_interval_ms + 86400000 / io_interval_ms
```

Leave margin below both approved limits after accounting for other consumers.
The example approaches 17,280 attempts per continuously busy day before small
boundary/timing variations and other applications. It is unsuitable for a
10,000-request daily quota. Scheduling has no daily counter or automatic daily
cutoff; current consumption also matters on the day of enablement. Cache hits
save calls, but do not count expected cache savings as guaranteed capacity.

Update the existing default `vars` and `env.io.vars` with the approved values:

```json
{
  "GTM_SNAPSHOT_CACHE_ENABLED": "true",
  "GTM_REQUEST_SCHEDULER_ENABLED": "true",
  "GTM_QUOTA_PROJECT_ID": "<VERIFIED_PRODUCTION_PROJECT_ID>",
  "GTM_REQUEST_INTERVAL_MS": "10000"
}
```

This is a vars fragment, not a replacement Wrangler configuration. Replace the
project placeholder and adjust the interval if the example's assumptions do not
hold. Keep the existing pending limit initially; increasing it does not extend
the per-request deadline.

Deploy both targets in a low-traffic window and verify their effective settings.
The combined allocation applies only after both serve the intended revision and
all active runtimes use scheduling. Reconnect legacy SSE clients; check older
versions, alternate routes and other quota consumers. Do not run a concurrency
probe while either host still sends unpaced requests. A partial deployment is
an incomplete rollout, not proof of project-wide protection.

Use a small bounded read-only probe on each host. Confirm `queue_wait` and
`google_attempt` events, inspect `queue_rejected` and `retry_wait`, and compare
the combined Google attempt rate with Google Cloud. Distinguish local admission
errors from Google's `rate` and `daily` quota failures. Each pagination page and
retry uses another permit; cache hits use none. Stricter intervals can cause
local deadline errors under concurrency because queueing and execution share a
bounded per-request budget. Larger list-client timeouts do not remove that
per-request limit; use the client settings in the Worker README.

## Observation and rollback

Keep per-host configuration, deployment IDs, quota assumptions, UTC intervals,
cache results, queue errors and combined consumption in the restricted release
record. Publish only a sanitized verification summary in the PR. Keep the
allocation unchanged through a full daily quota cycle before considering a
faster rate. An alert or operator check must cover daily usage because scheduler
pacing alone does not stop daily exhaustion.

- If quota consumption or Google quota errors rise, pause probes and reduce
  traffic or increase the affected intervals. Do not disable scheduling as the
  automatic response: doing so removes pacing. Recalculate both allocations
  before assigning a retired host's capacity to the other host.
- If queue rejection or latency is unacceptable, reduce load and reassess the
  split and approved quota. Do not speed up both hosts independently. Static
  allocation trades utilization for simplicity; a shared coordinator is a
  separate implementation option when flexible sharing is needed.
- If cached data is incorrect or cache delivery fails, set only
  `GTM_SNAPSHOT_CACHE_ENABLED=false`, retain scheduling and monitor the resulting
  increase in Google attempts. Reconnect retained SSE sessions as needed.
- If a scheduler or release defect requires disabling scheduling or restoring
  older code, first constrain traffic across both hosts. Treat the result as
  unpaced operation until verified otherwise. Retain Durable Object migrations,
  bindings and storage; do not delete cloud resources as a rollback shortcut.
- If telemetry is unavailable, stop progressing the rollout and restore
  observability before increasing traffic or relaxing intervals.

Keep feature flags and intervals in version control after any emergency
Dashboard change, before another deployment can overwrite them. No step in this
runbook requires publishing a GTM container.

## Known issue: OAuth sign-out and refresh

`gtm_remove_session` can report "Signed out" before access and refresh tokens
become unusable. A concurrent refresh can prolong access after sign-out. The
existing revocation mechanism uses eventually consistent storage; cache cleanup
does not provide immediate token revocation. This behavior predates snapshot
caching and scheduling and remains unresolved. Do not treat a successful
sign-out response or any fixed waiting period as proof that access is revoked.
