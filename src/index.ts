import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getPackageVersion, loadEnv, log } from "./utils";
import { tools } from "./tools";
import { HttpServerTransport } from "./server/http";
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
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    log(`Starting MCP server with HTTP transport on port ${port}...`);
    
    const transport = new HttpServerTransport(port);
    await server.connect(transport);
    
    log(`✅ MCP server started and listening on port ${port}`);
    log(`Health check available at http://localhost:${port}/health`);
    log(`MCP endpoint available at http://localhost:${port}/mcp`);
  } catch (error) {
    log(`❌ Error starting server: ${error}`);
    process.exit(1);
  }
}

main();
