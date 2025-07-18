import { Router } from "express";
import { SseController } from "./controllers/SseController";
import { StreamableController } from "./controllers/StreamableController";
import { OAuthController } from "./controllers/OAuthController";
import { McpAuthMiddleware } from "../middlewares/McpAuthMiddleware";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function createRouter(server: McpServer): Router {
  const router = Router();

  // Initialize controllers
  const sseController = new SseController();
  const streamableController = new StreamableController(server);
  const oauthController = new OAuthController();

  // Health check endpoint
  router.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Root endpoint with MCP server discovery
  router.get("/", (req, res) => {
    const host = req.get("host");
    const baseUrl = host?.includes("run.app") || process.env.NODE_ENV === "production"
      ? `https://${host}`
      : `${req.protocol}://${host}`;
    
    res.json({
      name: "google-tag-manager",
      version: "1.0.0",
      description: "Google Tag Manager MCP Server",
      mcp_endpoint: `${baseUrl}/mcp`,
      auth_required: true,
      auth_type: "oauth2",
      oauth_discovery: `${baseUrl}/.well-known/oauth-authorization-server`
    });
  });

  // OAuth discovery endpoints
  router.get("/.well-known/oauth-authorization-server", oauthController.getWellKnown);
  router.get("/.well-known/oauth-protected-resource", oauthController.getProtectedResource);

  // OAuth endpoints
  router.post("/oauth/register", oauthController.register);
  router.get("/oauth/authorize", oauthController.authorize);
  router.get("/oauth/callback", oauthController.callback);
  router.post("/oauth/token", oauthController.token);
  router.get("/oauth/status", oauthController.status);

  // MCP streamable HTTP endpoints
  router.post("/mcp", McpAuthMiddleware.requireAuth, streamableController.postMcp);
  router.get("/mcp", McpAuthMiddleware.requireAuth, streamableController.getMcp);
  router.delete("/mcp", McpAuthMiddleware.requireAuth, streamableController.deleteMcp);

  // Legacy SSE endpoints (if needed)
  router.get("/sse", McpAuthMiddleware.requireAuth, sseController.getSse);
  router.post("/messages", McpAuthMiddleware.requireAuth, sseController.postMessages);

  return router;
}
