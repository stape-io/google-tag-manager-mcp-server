// Served at /llms.txt (https://llmstxt.org).
export const LLMS_TXT = `# MCP Server for Google Tag Manager

> A Model Context Protocol (MCP) server for the Google Tag Manager API v2, maintained by Stape. It lets AI assistants read and manage GTM accounts, containers, workspaces, tags, triggers, variables, templates, versions and publishing.

- Hosted server (Google OAuth handled for you): https://gtm-mcp.stape.ai/mcp (streamable HTTP; legacy SSE at /sse)
- Local server over stdio with your own credentials: \`npx -y google-tag-manager-mcp-server\`
- Every GTM resource is one tool with an \`action\` parameter (e.g. \`gtm_tag\` with create/get/list/update/remove/revert), so the tool list stays small.
- Updates are full replacements: call 'get' first, send the complete object back with its fingerprint.
- Call \`gtm_guide\` for best-practice workflows (safe editing, naming, audits, tracking plans, Consent Mode, server-side tagging) and \`gtm_auth_status\` to diagnose credential problems.

## Docs

- [README and client setup](https://github.com/stape-io/google-tag-manager-mcp-server#readme): installation for Claude, ChatGPT, Cursor, VS Code, Copilot and other MCP clients
- [CLI package](https://github.com/stape-io/google-tag-manager-mcp-server/blob/main/packages/cli/README.md): credentials (service account, refresh token, access token) and scope narrowing with GTM_SCOPES
- [Core package](https://github.com/stape-io/google-tag-manager-mcp-server/blob/main/packages/core/README.md): embedding the tools in your own MCP server
- [Assistant skill](https://github.com/stape-io/google-tag-manager-mcp-server/blob/main/skills/google-tag-manager/SKILL.md): how an assistant should work with this server

## Optional

- [Step-by-step guide](https://stape.io/blog/mcp-server-for-google-tag-manager)
- [Google Tag Manager API v2 reference](https://developers.google.com/tag-platform/tag-manager/api/reference/rest)
`;
