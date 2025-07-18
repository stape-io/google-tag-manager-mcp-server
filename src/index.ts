import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getPackageVersion, loadEnv, log } from "./utils";
import { tools } from "./tools";
import { HttpServerTransport } from "./server/http";
import { SseServerTransport } from "./server/sse";
import path from "path";

// Load environment variables
loadEnv();

// Set GOOGLE_APPLICATION_CREDENTIALS if GTM_SERVICE_ACCOUNT_KEY_PATH is provided
if (process.env.GTM_SERVICE_ACCOUNT_KEY_PATH && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(process.env.GTM_SERVICE_ACCOUNT_KEY_PATH);
  log(`Set GOOGLE_APPLICATION_CREDENTIALS to ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
}

const server = new McpServer({
  name: "google-tag-manager",
  version: getPackageVersion(),
  protocolVersion: "2024-11-05",
  vendor: "stape-io",
  homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
    logging: {}
  }
});

// Register all tools with the server
tools.forEach((register) => register(server));

async function main(): Promise<void> {
  try {
    // Check if we should use stdio transport (default for MCP Inspector)
    const useStdio = process.argv.includes('--stdio') || process.env.MCP_TRANSPORT === 'stdio';
    
    if (useStdio) {
      log(`Starting MCP server with stdio transport...`);
      const transport = new StdioServerTransport();
      await server.connect(transport);
      log(`✅ MCP server started with stdio transport`);
    } else {
      const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
      log(`Starting MCP server with combined HTTP and SSE transport on port ${port}...`);
      
      // Use the HTTP transport which now includes SSE endpoints
      const transport = new HttpServerTransport(port);
      await server.connect(transport);
      
      log(`✅ MCP server started on port ${port}`);
      log(`Health check: http://localhost:${port}/health`);
      log(`HTTP MCP endpoint: http://localhost:${port}/mcp`);
      log(`SSE endpoint: http://localhost:${port}/sse`);
      log(`SSE message endpoint: http://localhost:${port}/message`);
    }
    
  } catch (error) {
    log(`❌ Error starting server: ${error}`);
    process.exit(1);
  }
}

main();
