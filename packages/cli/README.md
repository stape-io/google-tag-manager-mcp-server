# google-tag-manager-mcp-server

A local MCP server for the Google Tag Manager API. It runs on your machine and authenticates with credentials you provide, so no data passes through anyone else's server.

If you would rather not manage credentials, use the hosted server instead — it handles Google OAuth for you, see the [repository README](https://github.com/stape-io/google-tag-manager-mcp-server#readme).

## Usage

Add it to your MCP client. Nothing to install first — `npx` fetches it on demand:

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

## Credentials

Set one of these in the server's environment.

### Service account (recommended)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a service account and enable the **Tag Manager API** for its project.
2. Create a JSON key for it.
3. In GTM, add the service account's email (`...@....iam.gserviceaccount.com`) as a user on each account or container it should manage.

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account", ... }
```

The key can also be split into `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`. For Google Workspace domain-wide delegation, add `GOOGLE_IMPERSONATED_USER`.

### OAuth refresh token

Acts as one specific Google account — useful when GTM access cannot be shared with a service account.

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

### Access token

```
GOOGLE_ACCESS_TOKEN=...
```

Expires within the hour and is not refreshed — debugging only.

Optionally, `GTM_SCOPES` overrides the requested scopes (space or comma separated). The default set covers everything the tools do, from reading containers to publishing versions.

## Tools

One tool per GTM resource, each taking an `action` parameter (`list`, `get`, `create`, `update`, `remove`, …):

`gtm_account`, `gtm_container`, `gtm_workspace`, `gtm_tag`, `gtm_trigger`, `gtm_variable`, `gtm_built_in_variable`, `gtm_folder`, `gtm_client`, `gtm_template`, `gtm_transformation`, `gtm_zone`, `gtm_environment`, `gtm_version`, `gtm_version_header`, `gtm_gtag_config`, `gtm_destination`, `gtm_user_permission`.

The tools themselves live in [`google-tag-manager-mcp-core`](https://www.npmjs.com/package/google-tag-manager-mcp-core), which you can reuse to build a server with your own authentication.

## Troubleshooting

The server logs to stderr — your MCP client shows it in its server logs. If it exits immediately, the message says which environment variable is missing.

Some clients cap the combined server name + tool name at 60 characters; keep the server name short (`gtm-mcp-server`) so no tools get filtered out.

## License

Apache-2.0
