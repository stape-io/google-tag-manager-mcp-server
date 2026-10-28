# MCP Server for Google Tag Manager
[![Trust Score](https://archestra.ai/mcp-catalog/api/badge/quality/stape-io/google-tag-manager-mcp-server)](https://archestra.ai/mcp-catalog/stape-io__google-tag-manager-mcp-server)

An interface to the Google Tag Manager API over MCP, in two flavours: a hosted server with Google OAuth built in, and a local CLI that runs on your own credentials.

## Table of Contents

- [MCP Server for Google Tag Manager](#mcp-server-for-google-tag-manager)
  - [Table of Contents](#table-of-contents)
  - [Repository layout](#repository-layout)
  - [Installation](#installation)
    - [Claude Desktop](#claude-desktop)
    - [Claude Code](#claude-code)
    - [VS Code](#vs-code)
    - [GitHub Copilot](#github-copilot)
    - [Copilot CLI](#copilot-cli)
    - [Cursor](#cursor)
    - [Antigravity](#antigravity)
    - [ChatGPT](#chatgpt)
    - [Other MCP clients](#other-mcp-clients)
    - [Troubleshooting](#troubleshooting)
  - [Test your changes locally](#test-your-changes-locally)
    - [Changes to `packages/core` or `packages/cli`](#changes-to-packagescore-or-packagescli)
    - [Changes to `apps/worker`](#changes-to-appsworker)
      - [1. Set up a Google Cloud OAuth client](#1-set-up-a-google-cloud-oauth-client)
      - [2. Configure local environment variables](#2-configure-local-environment-variables)
      - [3. Start the server](#3-start-the-server)
      - [4. Point your MCP client at the local server](#4-point-your-mcp-client-at-the-local-server)
  - [Releasing](#releasing)
  - [Development](#development)
  - [Useful resources](#useful-resources)
  - [Open Source](#open-source)

## Repository layout

npm workspace with one app and two published packages:

| Path | Package | What it is |
| --- | --- | --- |
| `apps/worker` | *(private)* | The hosted Cloudflare Worker at `gtm-mcp.stape.io`: Google OAuth, the approval flow, the public pages, session removal. |
| `packages/cli` | [`google-tag-manager-mcp-server`](packages/cli/README.md) | The npm package: a local MCP server over stdio, authenticating with credentials you supply. |
| `packages/core` | [`google-tag-manager-mcp-core`](packages/core/README.md) | Every GTM tool and schema, independent of how credentials are obtained. |

Tools reach Google through a `GtmAuthProvider` (`getAccessToken(): Promise<string>`) rather than through any particular session, which is what lets the same tool set back both servers — and a private one with your own auth. See the [core package README](packages/core/README.md).

## Installation

This server comes in two flavours: Hosted server and Local CLI. Both give you the same 20 GTM tools; the difference is who handles Google auth.

| | Hosted server | Local CLI |
| --- | --- | --- |
| Auth | Google OAuth in your browser, handled for you | You supply a service account key, refresh token, or access token |
| Data | Passes through `gtm-mcp.stape.io` | Only ever leaves your machine |
| Setup | None | Set one environment variable |

If you're a contributor testing an unreleased change rather than just using the tools, skip everything below and see [Test your changes locally](#test-your-changes-locally) instead.

Pick your client below. The hosted server is a remote, HTTP-based MCP endpoint at `https://gtm-mcp.stape.io/mcp`. Clients that complete the Google OAuth flow themselves (Claude Desktop, Claude Code, VS Code, Copilot CLI, Cursor, ChatGPT) connect straight to that URL and sign you in with Google the first time they connect; the rest (Antigravity, stdio-only clients) reach it through [`mcp-remote`](https://github.com/geelen/mcp-remote#readme), a small bridge to remote HTTP MCP servers. Restart the client after changing its config.

### Claude Desktop

<details>
<summary>⬇️ Click to expand ⬇️</summary>

**Hosted server, custom connector (recommended).**

1. Go to **Customize → Connectors → Add custom connector**. On Team and Enterprise plans, an Owner adds it under **Organization settings → Connectors → Add → Custom** instead, and each member then selects **Connect** on it under **Customize → Connectors** and signs in with their own Google account.
2. Set a name (e.g. `gtm-mcp-server`) and the URL to `https://gtm-mcp.stape.io/mcp`. If the dialog asks how to authenticate, choose **Sign in now**; if it asks for an OAuth client, choose **Register automatically** (the server doesn't support **Use Claude's published identity**).
3. Select **Add**, then **Connect**, and sign in with Google.

The connector also works on claude.ai.

**Hosted server, `mcp-remote`.** To configure it through `claude_desktop_config.json` (Settings → Developer → Edit Config) instead:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gtm-mcp.stape.io/mcp"
      ]
    }
  }
}
```

**Local CLI** — no OAuth flow, no data through anyone else's server, you supply a service account key or a refresh token. Open Settings → Developer → Edit Config and add:

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

See the [CLI README](packages/cli/README.md) for every credential option.

</details>

### Claude Code

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Claude Code speaks HTTP directly, including the OAuth handshake, so the hosted server needs no bridge.

**Hosted server**:

```bash
claude mcp add --transport http gtm-mcp-server https://gtm-mcp.stape.io/mcp
```

Then run `/mcp` inside Claude Code (or `claude mcp login gtm-mcp-server` from the shell) and sign in with Google. `claude mcp list` shows whether it connected.

**Local CLI**:

```bash
claude mcp add gtm-mcp-server -e GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }' -- npx -y google-tag-manager-mcp-server
```

Both add the server to the current project only. Add `--scope user` to use it in every project. `--scope project` writes it to the project's `.mcp.json`, which suits the hosted server (no secrets in it, each teammate signs in with their own Google account) but not the Local CLI, whose entry holds your credentials.

</details>

### VS Code

<details>
<summary>⬇️ Click to expand ⬇️</summary>

VS Code's MCP client supports HTTP servers and their OAuth flow natively, no `mcp-remote` needed. Add this to `.vscode/mcp.json` (this workspace) or to the file **MCP: Open User Configuration** opens (every workspace):

**Hosted server**:

```json
{
  "servers": {
    "gtm-mcp-server": {
      "type": "http",
      "url": "https://gtm-mcp.stape.io/mcp"
    }
  }
}
```

VS Code asks you to sign in with Google when the server first starts.

**Local CLI**:

```json
{
  "servers": {
    "gtm-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "google-tag-manager-mcp-server"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "{\"type\":\"service_account\", ... }"
      }
    }
  }
}
```

</details>

### GitHub Copilot

<details>
<summary>⬇️ Click to expand ⬇️</summary>

GitHub Copilot Chat in VS Code uses VS Code's own MCP client, so it reads the same MCP configuration — see [VS Code](#vs-code) above. No separate configuration is needed.

</details>

### Copilot CLI

<details>
<summary>⬇️ Click to expand ⬇️</summary>

**Hosted server** — Copilot CLI completes OAuth natively for remote HTTP servers:

```bash
copilot mcp add --transport http gtm-mcp-server https://gtm-mcp.stape.io/mcp
```

Sign in with Google when Copilot CLI prompts you.

**Local CLI**:

```bash
copilot mcp add --env GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }' gtm-mcp-server -- npx -y google-tag-manager-mcp-server
```

Both write the server entry into `~/.copilot/mcp-config.json`. Run `copilot mcp get gtm-mcp-server` to check it. Inside an interactive session, `/mcp add` does the same through a form. See [GitHub's docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers#using-the-copilot-mcp-add-subcommand) for more.

</details>

### Cursor

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Cursor speaks HTTP directly, including the OAuth flow, no `mcp-remote` needed. Add this to `.cursor/mcp.json` (this project) or `~/.cursor/mcp.json` (every project):

**Hosted server**:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "url": "https://gtm-mcp.stape.io/mcp"
    }
  }
}
```

Then sign in with Google from the server's entry under **Customize** in Cursor's sidebar.

**Local CLI**:

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

</details>

### Antigravity

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Antigravity's OAuth support for remote HTTP servers doesn't get a token to the server yet ([antigravity-cli#25](https://github.com/google-antigravity/antigravity-cli/issues/25)), so use `mcp-remote` for the hosted server here. Add this to `~/.gemini/config/mcp_config.json`, which the Antigravity editor and CLI share. In the editor, open it from the agent panel via **… → MCP Servers → Manage MCP Servers → View raw config**:

**Hosted server**:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gtm-mcp.stape.io/mcp"
      ]
    }
  }
}
```

**Local CLI**:

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

Or, from the Antigravity CLI, run one of these (`agy mcp add` replaces an entry with the same name):

**Hosted server**:

```bash
agy mcp add gtm-mcp-server -- npx -y mcp-remote https://gtm-mcp.stape.io/mcp
```

**Local CLI**:

```bash
agy mcp add --env GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }' gtm-mcp-server -- npx -y google-tag-manager-mcp-server
```

`mcp-remote` opens the Google sign-in in your browser the first time it connects.

</details>

### ChatGPT

<details>
<summary>⬇️ Click to expand ⬇️</summary>

1. In ChatGPT on the web, go to [Plugins](https://chatgpt.com/plugins), select **+**, then **Add custom MCP server**.
2. Enter a name (e.g. `gtm-mcp-server`) and, under **Connection**, set the server URL to `https://gtm-mcp.stape.io/mcp`.
3. Set authentication to **OAuth**. The server supports Dynamic Client Registration, so no client ID or secret is needed.
4. Confirm the risk warning (**I understand and want to continue**), then select **Create as a plugin**.
5. Install the plugin from your personal plugins, sign in with Google, and pick it with `@` in the prompt box.

ChatGPT only reaches servers over the public internet, so there's no Local CLI option here, only the hosted server. Workspace admins can restrict custom MCP servers. See [OpenAI's docs](https://developers.openai.com/api/docs/guides/custom-mcp-server) for more.

</details>

### Other MCP clients

<details>
<summary>⬇️ Click to expand ⬇️</summary>

If your client supports remote HTTP MCP servers with OAuth, point it at `https://gtm-mcp.stape.io/mcp`, as in the [Cursor](#cursor) config. Otherwise, use `mcp-remote` for the hosted server:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://gtm-mcp.stape.io/mcp"
      ]
    }
  }
}
```

Or the local CLI directly, with your credentials:

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

</details>

### Troubleshooting

**Authentication errors**

If tools fail with 401/403 errors, ask your assistant to run `gtm_auth_status`. It reports whether the current Google token is accepted, when it expires and which Tag Manager scopes are missing, without revealing the token.

**MCP Server Name Length Limit**

Some MCP clients (like Cursor AI) have a 60-character limit for the combined MCP server name + tool name length. If you use a longer server name in your configuration (e.g., `gtm-mcp-server-your-additional-long-name`), some tools may be filtered out.

To avoid this issue:
- Use shorter server names in your MCP configuration (e.g., `gtm-mcp-server`)

**Clearing MCP Cache**

If you're connecting through `mcp-remote` (Antigravity, Claude Desktop configured that way, or other clients using the `mcp-remote` block), it stores all the credential information inside `~/.mcp-auth` (or wherever your `MCP_REMOTE_CONFIG_DIR` points to). If you're having persistent issues, try running:
```bash
rm -rf ~/.mcp-auth
```
Then, restart your MCP client.

## Test your changes locally

Which workflow you need depends on what you changed. Most changes are in the first
category — reach for the second only if you're touching the Worker itself.

### Changes to `packages/core` or `packages/cli`

This is the tool logic itself (schemas, GTM API calls, error handling) — almost
everything you'd fix or add lives here. You don't need a Google Cloud OAuth client
or any Worker setup: build from source and run the CLI directly with credentials
you already have.

```bash
git clone https://github.com/stape-io/google-tag-manager-mcp-server
cd google-tag-manager-mcp-server
gh pr checkout <PR number>   # or: git checkout <your-branch>
npm install
npm run build
```

Point your MCP client at the local build instead of `npx` — same credential
options as the [Claude Desktop](#claude-desktop) Local CLI example above, an access
token from the [OAuth Playground](https://developers.google.com/oauthplayground) is
the fastest way to test a single change:

```json
{
  "mcpServers": {
    "gtm-mcp-local": {
      "command": "node",
      "args": ["/absolute/path/to/google-tag-manager-mcp-server/packages/cli/dist/index.js"],
      "env": {
        "GOOGLE_ACCESS_TOKEN": "..."
      }
    }
  }
}
```

See the [CLI README](packages/cli/README.md) for every credential option.

### Changes to `apps/worker`

Only needed for the hosted server's own code: the OAuth flow, routing, session
handling, the approval and status pages. This runs that code on your own machine
against your own Google Cloud OAuth credentials instead of `gtm-mcp.stape.io`.

#### 1. Set up a Google Cloud OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), create or select a project, then enable the **Tag Manager API**.
2. Go to **APIs & Services > OAuth consent screen** and configure it (External is fine). While the app is in **Testing** publishing status, only accounts listed as test users can log in.
3. Go to **Audience**, under **Test users** add your own Google account.
4. Go to **APIs & Services > Credentials > Create Credentials > OAuth client ID**, type **Web application**.
5. Under **Authorized redirect URIs**, add `http://localhost:8788/callback`. (You can leave **Authorized JavaScript origins** empty — this flow is server-side only, no browser JS calls Google directly.)
6. Save, then copy the generated **Client ID** and **Client secret**.

#### 2. Configure local environment variables

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

#### 3. Start the server

```bash
npm install
npm run build
npm run dev
```

`npm run build` compiles the core package the Worker bundles against; `npm run dev` starts the Worker on `http://localhost:8788`.

#### 4. Point your MCP client at the local server

Claude Desktop's Custom Connectors need a publicly reachable URL, so `mcp-remote` is the only option for pointing at `localhost`:

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
local and hosted), clear mcp-remote's cache first (see [Troubleshooting](#troubleshooting) above)
and fully restart your MCP client, otherwise it may reuse a stale/cached connection.

## Releasing

Versions and changelogs are managed with [Changesets](https://github.com/changesets/changesets). Along with a change that should ship, add:

```bash
npm run changeset
```

On merge to `main` the release workflow opens a "Version Packages" PR; merging that PR publishes to npm, core first and then the CLI that depends on it. The Worker is private and never published — it deploys from `main` on every push.

## Development

Repository tooling requires Node.js 22+ (Wrangler's minimum); `.nvmrc` selects
Node 24, as used by the main CI jobs. Published core and CLI packages retain
Node.js 20.3+ support, verified by a separate compatibility job.

```bash
npm install
npm run build      # core, then the CLI, then the Worker's generated version
npm run typecheck
npm run lint
npm run smoke      # starts the built CLI and runs an MCP handshake against it
```

`npm test` builds fixtures once before running workspace suites. A standalone
`npm test -w google-tag-manager-mcp-core` builds its own core/CLI fixtures.
`npm test --ignore-scripts` expects fixtures to have been built explicitly.

`npm run check:versions` detects generated version-source drift without repairing
it. CI runs this before builds; use `node scripts/generate-version.mjs --all` to
regenerate it. The release workflow uses `npm run version-packages` so changeset
version bumps also regenerate core, CLI, and Worker source before committing.

Pull requests run all of the above plus a Worker bundle check, and flag changes to a published package that arrive without a changeset.

Both `@modelcontextprotocol/sdk` and `agents` are pinned to exact versions in `apps/worker`. The SDK identifies tool schemas with `instanceof`, so the whole workspace has to resolve a single copy, and `agents` releases pin the SDK version they were built against. Bump them together and deploy deliberately.

## Useful resources

- [Step-by-step guide: MCP Server for Google Tag Manager](https://stape.io/blog/mcp-server-for-google-tag-manager)

## Open Source

The **MCP Server for Google Tag Manager** is developed and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
