import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getPackageVersion } from "../utils";
import { tools } from "../tools";

export class McpServer {
  private server: SdkMcpServer;
  private initialized = false;

  constructor() {
    this.server = new SdkMcpServer(
      {
        name: "google-tag-manager",
        version: getPackageVersion(),
        protocolVersion: "2024-11-05",
        vendor: "stape-io",
        homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
      },
    );

    this.registerTools();
    this.registerRootsHandler();
    this.initialized = true;
  }

  private registerTools() {
    // Register all tools with the server
    tools.forEach((register) => register(this.server));
  }

  private registerRootsHandler() {
    // Note: Roots functionality not implemented as we don't need file system access
    // Claude Desktop might expect this but it's not required for our GTM server
  }

  async connect(transport: Transport): Promise<void> {
    if (!this.initialized) {
      throw new Error("McpServer not initialized");
    }

    return this.server.connect(transport);
  }

  getSdkServer(): SdkMcpServer {
    return this.server;
  }
}