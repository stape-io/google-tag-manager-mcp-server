import { Request, Response, NextFunction } from "express";
import { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { log } from "../utils";

interface GoogleTokenInfo {
  aud: string;
  scope: string;
  scopes?: string[];
  exp: number;
  email?: string;
}

async function validateGoogleToken(token: string): Promise<GoogleTokenInfo | null> {
  try {
    // Validate token with Google's tokeninfo endpoint
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
    
    if (!response.ok) {
      log(`Google token validation failed: ${response.status}`);
      return null;
    }
    
    const tokenInfo = await response.json() as GoogleTokenInfo;
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (tokenInfo.exp && tokenInfo.exp < now) {
      log("Token is expired");
      return null;
    }
    
    // Parse scopes from space-separated string
    if (tokenInfo.scope) {
      tokenInfo.scopes = tokenInfo.scope.split(' ');
    }
    
    return tokenInfo;
  } catch (error) {
    log(`Error validating Google token: ${error}`);
    return null;
  }
}

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

  static requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      // Validate Google OAuth token
      const tokenInfo = await validateGoogleToken(token);
      
      if (!tokenInfo) {
        res.status(401).json({
          error: "unauthorized",
          message: "Invalid or expired token",
        });
        return;
      }

      // Check if token has required GTM scopes
      const requiredScopes = [
        "https://www.googleapis.com/auth/tagmanager.readonly"
      ];
      
      const hasRequiredScope = requiredScopes.some(scope => 
        tokenInfo.scopes?.includes(scope)
      );

      if (!hasRequiredScope) {
        res.status(403).json({
          error: "insufficient_scope",
          message: "Token missing required Tag Manager scopes",
        });
        return;
      }

      const expectedResource = `${req.protocol}://${req.get("host")}/mcp`;
      
      const authInfo: AuthInfo = {
        clientId: tokenInfo.aud || "google-oauth-client",
        scopes: tokenInfo.scopes || ["read"],
        token: token,
        resource: new URL(expectedResource),
      };

      req.auth = authInfo;
      next();
    } catch (error) {
      log(`Authentication failed: ${error}`);
      res.status(401).json({
        error: "unauthorized",
        message: "Token validation failed",
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