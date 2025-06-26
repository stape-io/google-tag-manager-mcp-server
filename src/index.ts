import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  protocolVersion: "1.0",
  vendor: "stape-io",
  homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
});

// Register all tools with the server
tools.forEach((register) => register(server));

async function main(): Promise<void> {
  try {
    const httpPort = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const ssePort = process.env.SSE_PORT ? parseInt(process.env.SSE_PORT) : httpPort + 1;
    const transportType = process.env.TRANSPORT_TYPE || 'both';
    
    if (transportType === 'http' || transportType === 'both') {
      log(`Starting MCP server with HTTP transport on port ${httpPort}...`);
      const httpTransport = new HttpServerTransport(httpPort);
      
      // Create a separate server instance for HTTP
      const httpServer = new McpServer({
        name: "google-tag-manager-http",
        version: getPackageVersion(),
        protocolVersion: "1.0",
        vendor: "stape-io",
        homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
      });
      
      tools.forEach((register) => register(httpServer));
      await httpServer.connect(httpTransport);
      
      log(`✅ HTTP MCP server started on port ${httpPort}`);
      log(`Health check: http://localhost:${httpPort}/health`);
      log(`MCP endpoint: http://localhost:${httpPort}/mcp`);
    }
    
    if (transportType === 'sse' || transportType === 'both') {
      log(`Starting MCP server with SSE transport on port ${ssePort}...`);
      const sseTransport = new SseServerTransport(ssePort);
      
      // Use the main server instance for SSE
      await server.connect(sseTransport);
      
      log(`✅ SSE MCP server started on port ${ssePort}`);
      log(`Health check: http://localhost:${ssePort}/health`);
      log(`SSE endpoint: http://localhost:${ssePort}/sse`);
      log(`Message endpoint: http://localhost:${ssePort}/message`);
    }
    
  } catch (error) {
    log(`❌ Error starting server: ${error}`);
    process.exit(1);
  }
}

main();
