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

## Built-in auth providers

| Provider | Use it when |
| --- | --- |
| `createStaticTokenAuth({ accessToken, expiresAt })` | Some other layer already ran an OAuth flow and stores the token per session. Pass a function instead of an object when that session's token can be refreshed while the server runs. |
| `createRefreshTokenAuth({ clientId, clientSecret, refreshToken })` | The server owns one Google account's credentials and mints access tokens itself. |
| `createServiceAccountAuth({ clientEmail, privateKey, subject })` | The server authenticates as a service account (JWT bearer flow, RS256 via WebCrypto). Grant that service account access to the GTM accounts it manages, or use `subject` for domain-wide delegation. |

## Also exported

- `tools` — the default tool registrations, and each action module individually.
- All request schemas (`TagSchema`, `TriggerSchema`, `VariableSchema`, …).
- `GTM_API_SCOPES` / `GTM_OAUTH_SCOPES`, `GOOGLE_AUTHORIZE_URL`, `GOOGLE_TOKEN_URL`.
- `getTagManagerClient(auth)`, `createErrorResponse`, pagination helpers.
- `setLogSink()` — required for stdio servers, where stdout is the JSON-RPC stream and logs must go to stderr.

## License

Apache-2.0
