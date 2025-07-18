import { Request, Response, NextFunction } from "express";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { log } from "../utils";

// Extend Express Request type to include auth
declare global {
  namespace Express {
    interface Request {
      auth?: AuthInfo;
    }
  }
}

export class McpAuthMiddleware {
  static cors = (req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, DELETE"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, mcp-protocol-version"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Max-Age", "86400");
    
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  };

  static requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const host = req.get("host");
      const baseUrl = host?.includes("run.app") || process.env.NODE_ENV === "production"
        ? `https://${host}`
        : `${req.protocol}://${host}`;
      
      res.status(401).json({
        error: "unauthorized",
        message: "Bearer token required",
        auth: {
          type: "oauth2",
          authorization_url: `${baseUrl}/.well-known/oauth-authorization-server`
        }
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix
    
    try {
      // TODO: Implement proper token validation logic
      // For MCP compliance, we should validate token audience
      const expectedResource = `${req.protocol}://${req.get("host")}/mcp`;
      
      const authInfo: AuthInfo = {
        clientId: "default-client",
        scopes: ["read", "write"],
        token: token,
        resource: new URL(expectedResource),
      };

      req.auth = authInfo;
      next();
    } catch (error) {
      log(`Authentication failed: ${error}`);
      res.status(401).json({
        error: "unauthorized",
        message: "Invalid token",
      });
    }
  };

  static optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      
      try {
        const authInfo: AuthInfo = {
          clientId: "default-client",
          scopes: ["read", "write"],
          token: token,
        };

        req.auth = authInfo;
      } catch (error) {
        log(`Optional authentication failed: ${error}`);
        // Don't fail the request, just don't set auth
      }
    }
    
    next();
  };
}