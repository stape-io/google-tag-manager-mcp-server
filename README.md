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

## Repository layout

npm workspace with one app and two published packages:

| Path | Package | What it is |
| --- | --- | --- |
| `apps/worker` | *(private)* | The hosted Cloudflare Worker at `gtm-mcp.stape.ai`: Google OAuth, the approval flow, the public pages, session removal. |
| `packages/cli` | [`google-tag-manager-mcp-server`](packages/cli/README.md) | The npm package: a local MCP server over stdio, authenticating with credentials you supply. |
| `packages/core` | [`google-tag-manager-mcp-core`](packages/core/README.md) | Every GTM tool and schema, independent of how credentials are obtained. |

Tools reach Google through a `GtmAuthProvider` (`getAccessToken(): Promise<string>`) rather than through any particular session, which is what lets the same tool set back both servers — and a private one with your own auth. See the [core package README](packages/core/README.md).

## Installation

This server comes in two flavours: Hosted server and Local CLI. Both give you the same 18 GTM tools; the difference is who handles Google auth.

| | Hosted server | Local CLI |
| --- | --- | --- |
| Auth | Google OAuth in your browser, handled for you | You supply a service account key, refresh token, or access token |
| Data | Passes through `gtm-mcp.stape.ai` | Only ever leaves your machine |
| Setup | None | Set one environment variable |

If you're a contributor testing an unreleased change rather than just using the tools, skip everything below and see [Test your changes locally](#test-your-changes-locally) instead.

Pick your client below. The hosted server needs the [`mcp-remote`](https://github.com/geelen/mcp-remote#readme) bridge on clients whose MCP support doesn't complete Google's OAuth flow natively; where a client does that itself, it connects straight to `https://gtm-mcp.stape.ai/mcp`.

### Claude Desktop

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Open Claude Desktop and navigate to Settings -> Developer -> Edit Config. This opens the configuration file that controls which MCP servers Claude can access.

**Hosted server** — restart Claude Desktop after saving; a browser window opens for the Google OAuth flow. Complete it to grant Claude access:

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

**Local CLI** — no OAuth flow, no data through anyone else's server, you supply a service account key or a refresh token:

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
claude mcp add --transport http gtm-mcp-server https://gtm-mcp.stape.ai/mcp
```

A browser window opens for the Google OAuth flow the first time a tool is used. Run `/mcp` inside Claude Code to confirm it connected.

**Local CLI**:

```bash
claude mcp add gtm-mcp-server -e GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account", ... }' -- npx -y google-tag-manager-mcp-server
```

Both write into `.mcp.json` / your Claude Code MCP config.

</details>

### VS Code

<details>
<summary>⬇️ Click to expand ⬇️</summary>

VS Code's MCP client supports HTTP servers and their OAuth flow natively, no `mcp-remote` needed. Add this to `.vscode/mcp.json`:

**Hosted server**:

```json
{
  "servers": {
    "gtm-mcp-server": {
      "type": "http",
      "url": "https://gtm-mcp.stape.ai/mcp"
    }
  }
}
```

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

GitHub Copilot Chat in VS Code uses VS Code's own MCP client, so it reads the same `.vscode/mcp.json` file — see [VS Code](#vs-code) above. No separate configuration is needed.

</details>

### Copilot CLI

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Copilot CLI also completes OAuth natively for remote HTTP servers. Add this to `~/.copilot/mcp-config.json`:

**Hosted server**:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "type": "http",
      "url": "https://gtm-mcp.stape.ai/mcp"
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

See [GitHub's docs](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers) for the equivalent `copilot mcp add` subcommand.

</details>

### Cursor

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Cursor speaks HTTP directly too, no `mcp-remote` needed. Add this to `.cursor/mcp.json` (project-level) or `~/.cursor/mcp.json` (global — Settings → MCP → Add new global MCP server):

**Hosted server**:

```json
{
  "mcpServers": {
    "gtm-mcp-server": {
      "url": "https://gtm-mcp.stape.ai/mcp"
    }
  }
}
```

A browser window opens for the Google OAuth flow the first time a tool is used.

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

Antigravity's own OAuth support for remote HTTP servers doesn't reliably reach a token to the server yet ([antigravity-cli#25](https://github.com/google-antigravity/antigravity-cli/issues/25)), so use `mcp-remote` for the hosted server here too, the same way Claude Desktop does. Add this to `~/.gemini/config/mcp_config.json` (global) or `.agents/mcp_config.json` (workspace-local) — accessible from the editor's agent panel via **… → MCP Servers → Manage MCP Servers → View raw config**:

**Hosted server**:

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

### ChatGPT

<details>
<summary>⬇️ Click to expand ⬇️</summary>

1. In ChatGPT, enable Developer mode: Settings → Apps & Connectors → Advanced settings → Developer mode.
2. Go to Settings → Connectors → Create, and set the server URL to `https://gtm-mcp.stape.ai/mcp`.
3. Set Authentication to **OAuth** and complete the Google login in the browser window that opens.

ChatGPT only reaches servers over the public internet, it can't spawn a local process — so there's no Local CLI option here, only the hosted server.

</details>

### Other MCP clients

<details>
<summary>⬇️ Click to expand ⬇️</summary>

Any other MCP-compatible client that expects a stdio-style `command`/`args` config can use the same `mcp-remote` block for the hosted server:

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

**MCP Server Name Length Limit**

Some MCP clients (like Cursor AI) have a 60-character limit for the combined MCP server name + tool name length. If you use a longer server name in your configuration (e.g., `gtm-mcp-server-your-additional-long-name`), some tools may be filtered out.

To avoid this issue:
- Use shorter server names in your MCP configuration (e.g., `gtm-mcp-server`)

**Clearing MCP Cache**

If you're connecting through `mcp-remote` (Claude Desktop, Antigravity), it stores all the credential information inside `~/.mcp-auth` (or wherever your `MCP_REMOTE_CONFIG_DIR` points to). If you're having persistent issues, try running:
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
against your own Google Cloud OAuth credentials instead of `gtm-mcp.stape.ai`.

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

Same as the [Hosted server config above](#claude-desktop), but pointing at `localhost` instead of the hosted URL:

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

```bash
npm install
npm run build      # core, then the CLI, then the Worker's generated version
npm run typecheck
npm run lint
npm run smoke      # starts the built CLI and runs an MCP handshake against it
```

Pull requests run all of the above plus a Worker bundle check, and flag changes to a published package that arrive without a changeset.

Both `@modelcontextprotocol/sdk` and `agents` are pinned to exact versions in `apps/worker`. The SDK identifies tool schemas with `instanceof`, so the whole workspace has to resolve a single copy, and `agents` releases pin the SDK version they were built against. Bump them together and deploy deliberately.
