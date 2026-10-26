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

`gtm_tag`, `gtm_trigger`, and `gtm_variable` reuse a complete list snapshot across numeric pages. `page`, `itemsPerPage`, and exact pagination totals retain their existing meaning. `fresh: true` bypasses stored snapshots and in-flight scans; resource `get` calls always reach Google.

The default snapshot lifetime and retention limits are exported from [`listSnapshotCache.ts`](src/utils/listSnapshotCache.ts). Reads do not extend expiration. Concurrent reads of the same list share one upstream scan. Failed and incomplete scans are not cached.

Snapshots are isolated by credential and resource path. The auth provider is called before every read, including cache hits. Mutations invalidate the runtime's snapshots before and after the Google request, including failed requests. A read that overlaps a mutation completes without storing its result; later reads load a new snapshot. Changes made outside this runtime, including GTM permission changes, become visible when the snapshot expires or the caller requests `fresh: true`.

`createGtmRuntime()` provides an in-process backend for the CLI. The CLI enables caching by default and accepts `GTM_SNAPSHOT_CACHE_ENABLED=false` to disable it. `GtmSnapshotBackend.readPage()` optionally returns only the requested page and exact totals; backends that implement only `read()` remain supported. External backend reads and control operations have deadlines defined in [`gtmCacheTimeout.ts`](src/utils/gtmCacheTimeout.ts). A timed-out read returns an error without starting a duplicate scan. Invalidation failures emit `invalidation_error` and do not block Google writes; failed invalidation can leave previously cached data visible until expiry. A host can supply a `GtmSnapshotBackend` and a `GtmUsageObserver` through the optional `runtime` property of `createGtmMcpServer()` or `registerGtmTools()`. A supplied backend reports its own scan events (Google attempts and waits), so construct it with the same observer, for example `new ListSnapshotCache({ observer })`. A stateless host must reuse the backend across requests. Google requests keep the SDK transport, including its proxy settings; telemetry observes its adapter rather than replacing `fetch`. Confirmed daily-quota responses disable retries for that request while other operations retain the SDK retry policy. Observers receive allowlisted tool, cache, timing, status, and quota-category fields; they receive no credentials or GTM payloads.

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

## Optional request scheduling

Pass `scheduler: new LocalGtmRequestScheduler()` to `createGtmRuntime()` to pace
all Google attempts, including cache fills and retries, in one process. Share
one scheduler between runtimes that use the same quota project. Its defaults
are 4100ms between permits and 25 queued requests. A hosted deployment needs a
shared coordinator across processes; a local scheduler does not coordinate
separate CLI processes or other applications using the same Google project.

The CLI accepts `GTM_REQUEST_SCHEDULER_ENABLED=true`, with optional
`GTM_REQUEST_INTERVAL_MS` and `GTM_REQUEST_MAX_PENDING`. Scheduling is opt-in.
Scheduled calls use a 25-second total budget, bounded backoff and cancellation.
Daily and permission errors stop; uncertain writes are not replayed. Each retry
obtains a new permit and records its actual attempt separately from queue wait.
