# Claude Desktop Remote MCP Server Setup

## Overview
This Google Tag Manager MCP server has been enhanced to support remote connections from Claude Desktop using Server-Sent Events (SSE) transport, as documented in the [official Anthropic documentation](https://support.anthropic.com/en/article/11175166-getting-started-with-custom-integrations-using-remote-mcp).

## Current Status
✅ **Completed:**
- Added SSE transport implementation alongside existing HTTP transport
- Both transports run on single port (8080) for Cloud Run compatibility
- CORS headers configured for remote access
- Deployed to Cloud Run with both endpoints available

## Endpoints Available

### Cloud Run Deployment
**Base URL:** `https://google-tag-manager-mcp-server-483488785636.us-central1.run.app`

**Available Endpoints:**
- `GET /health` - Health check (returns transport info)
- `POST /mcp` - HTTP MCP endpoint (original)
- `GET /sse` - Server-Sent Events endpoint (new)
- `POST /message` - SSE message endpoint (new)

## Claude Desktop Configuration

To connect Claude Desktop to this remote MCP server, add the following to your Claude Desktop configuration file:

**Configuration file locations:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Configuration:**
```json
{
  "mcpServers": {
    "gtm-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sse", "https://google-tag-manager-mcp-server-483488785636.us-central1.run.app"],
      "env": {}
    }
  }
}
```

## Testing the SSE Endpoint

Test the SSE connection:
```bash
curl -H "Accept: text/event-stream" https://google-tag-manager-mcp-server-483488785636.us-central1.run.app/sse
```

Test with MCP Inspector:
```bash
npx @modelcontextprotocol/inspector https://google-tag-manager-mcp-server-483488785636.us-central1.run.app
```

## Technical Implementation

### Transport Architecture
- **Single Port Design**: Both HTTP and SSE endpoints run on port 8080 for Cloud Run compatibility
- **HTTP Transport**: Original `/mcp` endpoint for direct HTTP requests
- **SSE Transport**: New `/sse` endpoint for real-time bidirectional communication
- **CORS Enabled**: Headers configured for remote browser/desktop client access

### Files Modified
- `src/server/http.ts` - Enhanced with SSE endpoints and CORS
- `src/server/sse.ts` - Standalone SSE transport (not used in final implementation)
- `src/index.ts` - Simplified to use combined HTTP+SSE transport
- `Dockerfile` - Cleaned up build process
- `cloudbuild.yaml` - Updated container registry paths

## Future Plans

### Next Phase: Gemini Chat Interface
Plan to create a separate repository for a web-based chat interface that will:

1. **Connect to this MCP server** via SSE for real-time communication
2. **Integrate with Gemini API** for AI responses
3. **Provide Claude-like interface** for organization users
4. **Support streaming responses** using SSE for better UX

### Architecture Vision
```
User → Chat Interface → MCP Server (SSE) → Gemini API (streaming)
                   ↘ SSE stream ↗
```

### Benefits of SSE for Future Integration
- **Real-time streaming**: Perfect for Gemini API streaming responses
- **Bidirectional communication**: Enables interactive chat experience
- **Standard pattern**: Matches modern chat interface expectations
- **Better UX**: Users see responses as they're generated

## Key Requirements Met

From [Anthropic's remote MCP documentation](https://support.anthropic.com/en/article/11175166-getting-started-with-custom-integrations-using-remote-mcp):

✅ **SSE Transport Support**: Server-Sent Events implemented  
✅ **HTTPS Access**: Deployed on Cloud Run with HTTPS  
✅ **CORS Configuration**: Headers set for remote access  
✅ **Proper Error Handling**: Connection management and cleanup  

## Deployment Commands

To redeploy changes:
```bash
git add .
git commit -m "Your commit message"
git push origin main
```

Cloud Build will automatically trigger and deploy to Cloud Run.

## Testing Checklist

Before using with Claude Desktop:
- [ ] Test health endpoint returns 200
- [ ] Test SSE endpoint accepts connections
- [ ] Verify CORS headers present
- [ ] Test with MCP Inspector tool
- [ ] Configure Claude Desktop with SSE transport

## Notes

- Keep this server repository separate from future chat interface
- SSE implementation ready for both Claude Desktop and future Gemini integration
- All endpoints available on single port for simplified deployment