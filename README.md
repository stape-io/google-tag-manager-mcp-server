# MCP Server for Google Tag Manager
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/stape-io/google-tag-manager-mcp-server)](https://archestra.ai/mcp-catalog/stape-io__google-tag-manager-mcp-server)

An interface to the Google Tag Manager API over MCP, in two flavours: a hosted server with Google OAuth built in, and a local CLI that runs on your own credentials.

## Repository layout

npm workspace with one app and two published packages:

| Path | Package | What it is |
| --- | --- | --- |
| `apps/worker` | *(private)* | The hosted Cloudflare Worker at `gtm-mcp.stape.ai`: Google OAuth, the approval flow, the public pages, session removal. |
| `packages/cli` | [`google-tag-manager-mcp-server`](packages/cli/README.md) | The npm package: a local MCP server over stdio, authenticating with credentials you supply. |
| `packages/core` | [`google-tag-manager-mcp-core`](packages/core/README.md) | Every GTM tool and schema, independent of how credentials are obtained. |

Tools reach Google through a `GtmAuthProvider` (`getAccessToken(): Promise<string>`) rather than through any particular session, which is what lets the same tool set back both servers — and a private one with your own auth. See the [core package README](packages/core/README.md).

## Use the hosted server

Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.

Replace the content with the following configuration. Once you restart Claude Desktop, a browser window will open showing your OAuth login page. Complete the authentication flow to grant Claude access to your MCP server. After you grant access, the tools will become available for you to use.

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gtm-mcp.stape.ai/mcp"
      ]
    }
  }
}
```

## Or run it locally

No OAuth flow and no data through anyone else's server — you supply a service account key or a refresh token:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "command": "npx",
      "args": ["-y", "google-tag-manager-mcp-server"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "{\"type\":\"service_account\", ... }"
      }
    }
  }
}
```

See the [CLI README](packages/cli/README.md) for the credential options.

### Troubleshooting

**MCP Server Name Length Limit**

Some MCP clients (like Cursor AI) have a 60-character limit for the combined MCP server name + tool name length. If you use a longer server name in your configuration (e.g., `gtm-mcp-server-your-additional-long-name`), some tools may be filtered out.

To avoid this issue:
- Use shorter server names in your MCP configuration (e.g., `gtm-mcp-server`)

**Clearing MCP Cache**

[mcp-remote](https://github.com/geelen/mcp-remote#readme) stores all the credential information inside `~/.mcp-auth` (or wherever your `MCP_REMOTE_CONFIG_DIR` points to). If you're having persistent issues, try running:
```bash
rm -rf ~/.mcp-auth
```
Then, restart your MCP client.

## Running the Worker locally

You can run the hosted server on your own machine against your own Google Cloud OAuth
credentials instead of `gtm-mcp.stape.ai`. This is useful for testing
changes before they're deployed.

### 1. Set up a Google Cloud OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project, then enable the **Tag Manager API**.
2. Go to **APIs & Services > OAuth consent screen** and configure it (External is fine). While the app is in **Testing** publishing status, only accounts listed as test users can log in.
3. Go to **Audience**, under **Test users** add your own Google account.
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**, type **Web application**.
5. Under **Authorized redirect URIs**, add `http://localhost:8788/callback`. (You can leave **Authorized JavaScript origins** empty — this flow is server-side only, no browser JS calls Google directly.)
6. Save, then copy the generated **Client ID** and **Client secret**.

### 2. Configure local environment variables

Copy the example file and fill in the values from the previous step:

```bash
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

```
GOOGLE_CLIENT_ID="<your client ID>"
GOOGLE_CLIENT_SECRET="<your client secret>"
COOKIE_ENCRYPTION_KEY="<any random string, at least 32 chars, e.g. output of: openssl rand -hex 32>"
WORKER_HOST="http://localhost:8788"
HOSTED_DOMAIN=""
```

`.dev.vars` is git-ignored — it's only used locally and never committed.

### 3. Start the server

```bash
npm install
npm run build
npm run dev
```

`npm run build` compiles the core package the Worker bundles against; `npm run dev` starts the Worker on `http://localhost:8788`.

### 4. Point your MCP client at the local server

Same as the [Claude Desktop config above](#use-the-hosted-server), but pointing at `localhost` instead of the hosted URL:

```json
{
  "mcpServers": {
    "gtm-mcp-server-local": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:8788/mcp"]
    }
  }
}
```

Restart Claude Desktop. A browser window will open for the Google OAuth flow; log in with the
account you added as a test user in step 1.

**Note:** if you've previously connected to the hosted server (or switch back and forth between
local and hosted), clear mcp-remote's cache first (see "Clearing MCP Cache" above)
and fully restart your MCP client, otherwise it may reuse a stale/cached connection.

## Releasing

Versions and changelogs are managed with [Changesets](https://github.com/changesets/changesets). Along with a change that should ship, add:

```bash
npm run changeset
```

On merge to `main` the release workflow opens a "Version Packages" PR; merging that PR publishes to npm, core first and then the CLI that depends on it. The Worker is private and never published — it deploys from `main` on every push.

## Development

```bash
npm install
npm run build      # core, then the CLI, then the Worker's generated version
npm run typecheck
npm run lint
npm run smoke      # starts the built CLI and runs an MCP handshake against it
```

Pull requests run all of the above plus a Worker bundle check, and flag changes to a published package that arrive without a changeset.

Both `@modelcontextprotocol/sdk` and `agents` are pinned to exact versions in `apps/worker`. The SDK identifies tool schemas with `instanceof`, so the whole workspace has to resolve a single copy, and `agents` releases pin the SDK version they were built against. Bump them together and deploy deliberately.
