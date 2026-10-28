# google-tag-manager-mcp-core

The reusable half of the [Google Tag Manager MCP server](https://github.com/stape-io/google-tag-manager-mcp-server): every GTM tool, its input schemas and helpers, with **no opinion about how credentials are obtained**.

Authentication is a single interface, so the same tool set can back a public server doing per-user Google OAuth, a private server holding its own service account, or anything else:

```ts
export interface GtmAuthProvider {
  getAccessToken(): Promise<string>;
}
```

The package is runtime agnostic — it runs on Cloudflare Workers and in Node (token signing uses WebCrypto, not Node-only APIs).

## Install

```bash
npm install google-tag-manager-mcp-core
```

`@modelcontextprotocol/sdk` and `zod` are peer dependencies on purpose: the SDK identifies tool schemas with `instanceof` checks, so core and the host server have to share one copy of each. If the host pins an exact SDK version (the `agents` package does), match that version in your own `package.json` so npm hoists a single copy.

## Usage

### A standalone server

```ts
import {
  createGtmMcpServer,
  createServiceAccountAuth,
  parseServiceAccountKey,
} from "google-tag-manager-mcp-core";

const server = createGtmMcpServer({
  auth: createServiceAccountAuth({
    ...parseServiceAccountKey(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
    // Optional: impersonate a user through domain-wide delegation.
    subject: process.env.GOOGLE_IMPERSONATED_USER,
  }),
  serverInfo: { name: "my-gtm-mcp-server", version: "1.0.0" },
});

await server.connect(transport);
```

### Tools on a server you already own

When the `McpServer` instance belongs to a framework (an `McpAgent` subclass, for example), register the tools onto it instead:

```ts
import { registerGtmTools } from "google-tag-manager-mcp-core";

registerGtmTools(this.server, { auth });
```

To change which tools get registered: `createGtmMcpServer` takes `tools` (replaces the default set) and `extraTools` (added on top), while `registerGtmTools` takes the registrations to use as its third argument.

```ts
registerGtmTools(this.server, { auth }, [...tools, myPrivateTool]);
```

### Custom auth

Anything that can produce an access token works — a token vault, an internal auth service, per-request credentials:

```ts
const auth: GtmAuthProvider = {
  async getAccessToken() {
    return myAuthBackend.getGoogleTokenFor(currentUser);
  },
};
```

`getAccessToken()` is called on every tool invocation, so providers should cache and refresh internally. `createCachedTokenSource()` is exported for that: it reuses a token until just before it expires and collapses concurrent refreshes into one request.

## List snapshots

Core-library factories and direct tool registration enable list caching by default,
not only the CLI. To opt out, pass
`runtime: createGtmRuntime({ enabled: false })` to `createGtmMcpServer()` or
`registerGtmTools()`. This does not change the hosted service's explicit rollout flags.
Full-snapshot results and paginated entities are defensive copies; callers cannot
mutate retained cache data through these APIs. Node.js 20.3 or newer is required.

`gtm_tag`, `gtm_trigger`, and `gtm_variable` reuse a complete list snapshot across numeric pages. `page`, `itemsPerPage`, and exact pagination totals retain their existing meaning. `fresh: true` bypasses stored snapshots and in-flight scans; resource `get` calls always reach Google.

The default snapshot lifetime and retention limits are exported from [`listSnapshotCache.ts`](src/utils/listSnapshotCache.ts). Reads do not extend expiration. Concurrent reads of the same list share one upstream scan while it completes a page at least every 30 seconds. Each completed page refreshes this inactivity window. After 30 seconds without a completed page, later readers start a replacement scan while existing readers can continue waiting for the original. This admission window does not impose an operation timeout. Automatic replacements share the first complete result from their active scan family, cache it, and stop redundant pagination. An already-started Google request may still execute. `fresh: true` and mutation/clear invalidation create separate families: earlier scans cannot satisfy those reads or overwrite their snapshots. A failed or cancelled scan does not fail another live family member. Failed and incomplete scans are not cached.

Snapshots are isolated by credential and resource path. The auth provider is called before every read, including cache hits. Mutations invalidate the runtime's snapshots before and after the Google request, including failed requests. A read that overlaps a mutation completes without storing its result; later reads load a new snapshot. Changes made outside this runtime, including GTM permission changes, become visible when the snapshot expires or the caller requests `fresh: true`.

`createGtmRuntime()` provides the default in-process backend for core embedders and the CLI. Caching is enabled by default in both; the CLI accepts `GTM_SNAPSHOT_CACHE_ENABLED=false`, while embedders pass `enabled: false` to their runtime. `GtmSnapshotBackend.readPage()` optionally returns only the requested page and exact totals; backends that implement only `read()` remain supported. Cache control operations have deadlines defined in [`gtmCacheTimeout.ts`](src/utils/gtmCacheTimeout.ts); external backend read guards apply only when scheduling is enabled. A timed-out read returns an error without starting a duplicate scan. Invalidation failures emit `invalidation_error` and do not block Google writes; failed invalidation can leave previously cached data visible until expiry. A host can supply a `GtmSnapshotBackend` and a `GtmUsageObserver` through the optional `runtime` property of `createGtmMcpServer()` or `registerGtmTools()`. A supplied backend reports its own scan events (Google attempts and waits), so construct it with the same observer. When scheduling is enabled, supply the same scheduler to the backend as well; see the scheduling example below. A stateless host must reuse its backend across requests within the intended invalidation scope. Mutation leases and invalidation cover the entire backend, across all stored credentials and client namespaces. Use separate backend instances for unrelated tenants: credential isolation prevents data sharing but does not isolate invalidation or cache-bypass effects. Cross-client invalidation for the same Google user is intentional, since clients share mutable resources and some operations affect containers not named in the request path. If a mutation start succeeds but its end is lost, its lease suppresses caching for that whole backend for up to 120 seconds; reuse resumes once all active leases end or expire. Google requests keep the SDK transport, including its proxy settings; telemetry observes its adapter rather than replacing `fetch`. Confirmed daily-quota responses disable retries for that request while other operations retain the SDK retry policy. Observers receive allowlisted tool, cache, timing, status, and quota-category fields; they receive no credentials or GTM payloads.

## Optional request scheduling

Pass `scheduler: new LocalGtmRequestScheduler()` to `createGtmRuntime()` to pace
all Google attempts, including default-backend cache fills and retries, in one process. Share
one scheduler between runtimes that use the same quota project. Its defaults
are 4100ms between permits and an upper bound of 25 queued requests. Admission also requires a slot before the request deadline; at default pacing and a 25-second request budget, that deadline is tighter than the capacity setting. Raising capacity alone does not extend the budget; lower capacities or faster approved pacing can make the capacity limit bind. A hosted deployment needs a
shared coordinator across processes; a local scheduler does not coordinate
separate CLI processes or other applications using the same Google project.

A supplied backend owns its upstream request execution. Runtime options do not
configure that backend automatically. When supplying `ListSnapshotCache`, pass
the same scheduler and observer to both:

```ts
import {
  createGtmRuntime,
  ListSnapshotCache,
  LocalGtmRequestScheduler,
} from "google-tag-manager-mcp-core";

const scheduler = new LocalGtmRequestScheduler();
const backend = new ListSnapshotCache({ scheduler, observer });
const runtime = createGtmRuntime({ backend, scheduler, observer });
// Pass runtime to createGtmMcpServer() or registerGtmTools().
```

Here `observer` is your optional `GtmUsageObserver` callback. Custom and remote
backends must implement equivalent scheduling themselves; the runtime scheduler
paces ordinary calls, while the backend scheduler paces list scans and retries.

The CLI accepts `GTM_REQUEST_SCHEDULER_ENABLED=true`, with optional
`GTM_REQUEST_INTERVAL_MS` and `GTM_REQUEST_MAX_PENDING`. Scheduling is opt-in.
Scheduled ordinary calls use a 25-second total budget. List operations use a separate five-minute total budget, including tools that paginate without snapshots. Each upstream request has at most 25 seconds for queueing, execution and retries, clipped to the remaining operation budget. Backoff and cancellation remain bounded.
Daily and permission errors stop; uncertain writes are not replayed. Each retry
obtains a new permit and records its actual attempt separately from queue wait.

For the connected MCP TypeScript SDK client, the default request timeout is
60 seconds. Set a longer timeout for calls that may need the full list budget:

```ts
const result = await client.callTool(
  {
    name: "gtm_tag",
    arguments: {
      action: "list",
      accountId: "1",
      containerId: "2",
      workspaceId: "3",
    },
  },
  { timeout: 310_000 }, // Five-minute list budget plus delivery allowance.
);
```

Configure equivalent timeouts in other clients where supported. The server cannot
extend a client's timeout. If the last reader times out or cancels, its scan is
cancelled and partial data is not cached; another live reader can keep it running.

Custom tools can select the operation budget independently of their action name:

```ts
const invocation = runtime.startCall(auth, "custom_export", "export", signal, {
  operationKind: "list",
});
const google = await getTagManagerClient(auth, invocation);
// Use this client for the custom tool's pagination loop.
```

`signal` is the tool request's abort signal. The optional fifth argument accepts
`operationKind: "list"` (five-minute operation) or `"single"` (25-second operation).
Omitting it preserves existing defaults: action `"list"` uses the list budget;
other actions use the single-operation budget. Every individual upstream request
still has at most 25 seconds including queueing and retries, whichever operation
kind is selected. These budgets apply when scheduling is enabled.

With scheduling enabled, each shared scan has a fixed five-minute producer budget
independent of its first reader's deadline. New readers start a replacement instead of joining when less than 25 seconds remains, even if the scan is making progress. Each subscriber enforces its own deadline and cancellation;
short-lived readers do not terminate a scan still needed by others. Joining does
not extend the producer cap indefinitely, so a scan hitting that cap can still
fail all remaining subscribers. Hosted backend read guards allow 305 seconds for the list budget and delivery. Clients must allow sufficient request time to benefit from longer lists; earlier client cancellation still applies. Cancellation also reaches Google when request
scheduling is disabled.

With scheduling disabled, enabling caching does not introduce a 25-second scan
cap or a hosted-cache read timeout. Normal caller, transport and platform limits
still apply. Explicit subscriber deadlines and cancellation remain honored.
Scheduled timeout errors retain preceding upstream failure context; user
cancellations remain distinct from timeouts. The local scheduler rejects a new request immediately if its predicted FIFO slot is at or beyond its deadline. It skips already-cancelled work and work expiring before its slot; later cancellations can free capacity for subsequent admission. A permit near the deadline can still leave little execution time, so admission does not guarantee completion.

## Built-in auth providers

| Provider                                                           | Use it when                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createStaticTokenAuth({ accessToken, expiresAt })`                | Some other layer already ran an OAuth flow and stores the token per session. Pass a function instead of an object when that session's token can be refreshed while the server runs.                  |
| `createRefreshTokenAuth({ clientId, clientSecret, refreshToken })` | The server owns one Google account's credentials and mints access tokens itself.                                                                                                                     |
| `createServiceAccountAuth({ clientEmail, privateKey, subject })`   | The server authenticates as a service account (JWT bearer flow, RS256 via WebCrypto). Grant that service account access to the GTM accounts it manages, or use `subject` for domain-wide delegation. |

## Also exported

- `tools` — the default tool registrations, and each action module individually.
- All request schemas (`TagSchema`, `TriggerSchema`, `VariableSchema`, …).
- `GTM_API_SCOPES` / `GTM_OAUTH_SCOPES`, `GOOGLE_AUTHORIZE_URL`, `GOOGLE_TOKEN_URL`.
- `getTagManagerClient(auth)`, `createErrorResponse`, pagination helpers.
- `setLogSink()` — required for stdio servers, where stdout is the JSON-RPC stream and logs must go to stderr.

## License

Apache-2.0
