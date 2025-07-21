# Google Tag Manager MCP Server

A Model Context Protocol (MCP) server that provides access to the Google Tag Manager API with OAuth 2.0 + PKCE authentication support. Compatible with Claude Desktop, MCP Inspector, and other MCP clients.

## Features

- **Complete OAuth 2.0 + PKCE Flow** - Secure per-user authentication
- **MCP Protocol Compliance** - Full support for MCP 2024-11-05
- **Comprehensive GTM API Coverage** - All major GTM operations supported
- **Remote MCP support** - Support deployment on Cloud Run
- **Multiple Auth Methods** - OAuth 2.0 (recommended) and Service Account

## Quick Start

### Local Development
```bash
npm install
npm run dev
# Server runs on http://localhost:3000
```

### Production Deployment
```bash
npm run build
gcloud builds submit --config cloudbuild.yaml
```

## Authentication

### OAuth 2.0 with PKCE (Recommended)

1. **Create OAuth 2.0 credentials** in Google Cloud Console:
   - Go to "APIs & Services" > "Credentials"
   - Create "OAuth 2.0 Client IDs" > "Web application"
   - Add your redirect URIs (see Integration section)

2. **Set environment variables**:
   ```bash
   OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
   OAUTH_CLIENT_SECRET=your-client-secret
   ```

3. **Required Google OAuth Redirect URIs**:
   - Claude.ai: `https://claude.ai/api/mcp/auth_callback`
   - MCP Inspector: `http://localhost:6274/oauth/callback`
   - Local deployment: `http://localhost:3000`
   - Your remote deployment: `https://your-domain.com/oauth/callback`

### Service Account (Server-to-Server)
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
# OR
GTM_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json
```

## Integration

### MCP Connector Approach
The server exposes an MCP endpoint that can be used with any MCP-compatible client using the connector pattern:

**MCP Endpoint URL**: `https://your-deployment-url.com/mcp`

### Supported MCP Clients

**Claude Desktop**:
- Use the `@modelcontextprotocol/server-fetch` connector
- Configure with your deployed server's `/mcp` endpoint

**MCP Inspector**:
- Connect directly to the `/mcp` endpoint URL
- Supports full OAuth flow testing and debugging

**Custom MCP Clients**:
- Any client supporting MCP 2024-11-05 protocol
- Streamable HTTP transport over the `/mcp` endpoint
- SSE over the `/sse` endpoint
- OAuth 2.0 + PKCE authentication flow

### Authentication Flow for MCP Clients

1. **Discovery**: Client fetches OAuth metadata from `/.well-known/oauth-authorization-server`
2. **Registration**: Client registers via `POST /oauth/register` (dynamic registration)
3. **Authorization**: Client redirects user to `GET /oauth/authorize` with PKCE
4. **Token Exchange**: Client exchanges auth code via `POST /oauth/token`
5. **MCP Requests**: Client uses Bearer token for authenticated `/mcp` requests

## API Endpoints

### Core MCP Protocol
- `POST /mcp` - MCP protocol endpoint (initialization and messages)
- `GET /mcp` - MCP session requests  
- `DELETE /mcp` - MCP session cleanup
- `GET /sse` - Server-Sent Events transport for MCP
- `POST /messages` - SSE message endpoint

### OAuth Discovery (MCP Compliance)
- `GET /.well-known/oauth-authorization-server` - OAuth server metadata
- `GET /.well-known/oauth-protected-resource` - Protected resource metadata

### OAuth Flow
- `POST /oauth/register` - Dynamic client registration
- `GET /oauth/authorize` - Authorization endpoint with PKCE
- `POST /oauth/token` - Token exchange endpoint
- `GET /oauth/status` - Authentication status

### Utility
- `GET /health` - Health check endpoint

## Architecture

```
src/
├── app.ts                    # Express server setup
├── container.ts              # Dependency injection
├── mcp/
│   └── McpServer.ts         # MCP server implementation
├── middlewares/
│   └── McpAuthMiddleware.ts # OAuth token validation
├── server/
│   ├── controllers/         # OAuth & MCP request handlers
│   └── router.ts           # Route definitions
├── tools/                  # GTM API tools organized by resource
├── schemas/                # Zod validation schemas
└── utils/                  # Shared utilities
```

## Development

### Commands
```bash
npm run dev                # Development with hot reload
npm run build             # Build for production
npm run lint              # Code style checking
npm run lint:fix          # Fix linting issues
```

### Environment Variables
```bash
# OAuth 2.0 (recommended)
OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
OAUTH_CLIENT_SECRET=your-client-secret

# OR Service Account (fallback)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Server configuration
PORT=3000
NODE_ENV=production
```

## Deployment

### Google Cloud Run
The server is designed for deployment on Google Cloud Run:

1. **Build and deploy**:
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

2. **Set environment variables** in Cloud Run console

3. **Update OAuth redirect URIs** with your deployment URL

### Docker
```bash
docker build -t gtm-mcp-server .
docker run -d -p 3000:3000 --env-file .env gtm-mcp-server
```

## Security

- **OAuth 2.0 + PKCE**: Secure authorization code flow with proof key
- **Token Validation**: Real-time Google OAuth token verification
- **Scoped Access**: Required GTM API permissions only
- **Session Isolation**: Per-session MCP transport management
- **CORS Support**: Configurable cross-origin requests

## Troubleshooting

### OAuth Issues
- Verify redirect URIs match exactly in Google Cloud Console
- Check OAuth client ID and secret are correct
- Ensure proper GTM API scopes are granted

### MCP Connection Issues
- Verify Bearer token in Authorization header
- Check MCP protocol version is 2024-11-05
- Ensure Accept header includes `application/json`

### Common Errors
- `401 Unauthorized` - Invalid or expired OAuth token
- `403 Forbidden` - Insufficient GTM permissions
- `invalid_session` - MCP session expired or not found

## License

Apache-2.0