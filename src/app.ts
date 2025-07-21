import express from 'express';
import { McpAuthMiddleware } from './middlewares/McpAuthMiddleware';
import { createRouter } from './server/router';
import { Container } from './container';
import { log } from './utils';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(McpAuthMiddleware.cors);

// Get container and create router
const container = Container.getInstance();
const router = createRouter(container.getMcpServer().getSdkServer());
app.use(router);

app.listen(PORT, () => {
  const isProduction = process.env.NODE_ENV === "production" || process.env.GOOGLE_CLOUD_PROJECT;
  const baseUrl = isProduction 
    ? "https://google-tag-manager-mcp-server-483488785636.us-central1.run.app"
    : `http://localhost:${PORT}`;
  
  log(`✅ MCP server started on port ${PORT}`);
  log(`Health check: ${baseUrl}/health`);
  log(`MCP endpoint: ${baseUrl}/mcp`);
  log(`OAuth discovery: ${baseUrl}/.well-known/oauth-authorization-server`);
});