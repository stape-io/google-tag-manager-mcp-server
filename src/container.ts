import { SseController } from './server/controllers/SseController';
import { StreamableController } from './server/controllers/StreamableController';
import { OAuthController } from './server/controllers/OAuthController';
import { McpAuthMiddleware } from './middlewares/McpAuthMiddleware';
import { McpServer } from './mcp/McpServer';
import { loadEnv, log } from './utils';
import path from 'path';

export class Container {
  private static instance: Container;
  private mcpServer: McpServer;
  private sseController: SseController;
  private streamableController: StreamableController;
  private oauthController: OAuthController;

  private constructor() {
    // Load environment variables
    loadEnv();

    // Set GOOGLE_APPLICATION_CREDENTIALS if GTM_SERVICE_ACCOUNT_KEY_PATH is provided
    if (
      process.env.GTM_SERVICE_ACCOUNT_KEY_PATH &&
      !process.env.GOOGLE_APPLICATION_CREDENTIALS
    ) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(
        process.env.GTM_SERVICE_ACCOUNT_KEY_PATH,
      );
      log(
        `Set GOOGLE_APPLICATION_CREDENTIALS to ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`,
      );
    }

    // Create MCP server
    this.mcpServer = new McpServer();

    // Initialize controllers
    this.sseController = new SseController();
    this.streamableController = new StreamableController(this.mcpServer.getSdkServer());
    this.oauthController = new OAuthController();
  }

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  getMcpServer() {
    return this.mcpServer;
  }

  getSseController() {
    return this.sseController;
  }

  getStreamableController() {
    return this.streamableController;
  }

  getOAuthController() {
    return this.oauthController;
  }

  getAuthMiddleware() {
    return McpAuthMiddleware;
  }
}