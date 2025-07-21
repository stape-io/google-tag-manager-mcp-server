import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { log } from "../../utils";

interface PkceData {
  code_challenge: string;
  code_challenge_method: string;
  client_id: string;
  redirect_uri: string;
  expiresAt: number;
  createdAt: number;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expiresAt: number;
}

export class OAuthController {
  private pkceStore = new Map<string, PkceData>();
  private static tokenStore = new Map<string, TokenData>();

  constructor() {
    // Cleanup expired PKCE challenges every 2 minutes
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, data] of this.pkceStore.entries()) {
        if (now > data.expiresAt) {
          this.pkceStore.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        log(`Cleaned up ${cleanedCount} expired PKCE challenges`);
      }
    }, 2 * 60 * 1000);
  }
  // Handle GET /.well-known/oauth-authorization-server
  getWellKnown = (req: Request, res: Response) => {
    const host = req.get("host");
    const baseUrl =
      host?.includes("run.app") || process.env.NODE_ENV === "production"
        ? `https://${host}`
        : `${req.protocol}://${host}`;

    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "client_credentials"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [
        "https://www.googleapis.com/auth/tagmanager.readonly",
        "https://www.googleapis.com/auth/tagmanager.edit.containers",
        "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        "https://www.googleapis.com/auth/tagmanager.manage.accounts",
        "https://www.googleapis.com/auth/tagmanager.manage.users",
        "https://www.googleapis.com/auth/tagmanager.publish",
        "https://www.googleapis.com/auth/tagmanager.delete.containers",
      ],
    });
  };

  // Handle GET /.well-known/oauth-protected-resource
  getProtectedResource = (req: Request, res: Response) => {
    const host = req.get("host");
    const baseUrl =
      host?.includes("run.app") || process.env.NODE_ENV === "production"
        ? `https://${host}`
        : `${req.protocol}://${host}`;

    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [
        `${baseUrl}/.well-known/oauth-authorization-server`,
      ],
      scopes_supported: [
        "https://www.googleapis.com/auth/tagmanager.readonly",
        "https://www.googleapis.com/auth/tagmanager.edit.containers",
        "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        "https://www.googleapis.com/auth/tagmanager.manage.accounts",
        "https://www.googleapis.com/auth/tagmanager.manage.users",
        "https://www.googleapis.com/auth/tagmanager.publish",
        "https://www.googleapis.com/auth/tagmanager.delete.containers",
      ],
      bearer_methods_supported: ["header", "body"],
      resource_documentation: `${baseUrl}/docs`,
    });
  };

  // OAuth client registration endpoint
  register = (req: Request, res: Response) => {
    const params = req.body;
    
    log(`Client registration request: ${JSON.stringify(params)}`);

    const clientId = randomUUID();

    res.status(201).json({
      client_id: clientId,
      client_name: params.client_name,
      grant_types: params.grant_types || ["authorization_code", "refresh_token"],
      response_types: params.response_types || ["code"],
      token_endpoint_auth_method: params.token_endpoint_auth_method || "none",
      scope: params.scope,
      redirect_uris: params.redirect_uris,
    });
  };

  // OAuth authorization endpoint
  authorize = (req: Request, res: Response): void => {
    const { 
      client_id, 
      redirect_uri, 
      response_type, 
      scope, 
      state, 
      code_challenge, 
      code_challenge_method,
      resource 
    } = req.query;

    // Validate required parameters
    if (!client_id || !redirect_uri || !code_challenge || !code_challenge_method) {
      res.status(400).json({ 
        error: "invalid_request", 
        error_description: "Missing required parameters" 
      });
      return;
    }

    // Validate resource parameter if provided (MCP spec requirement)
    if (resource) {
      const host = req.get("host");
      const baseUrl = host?.includes("run.app") || process.env.NODE_ENV === "production"
        ? `https://${host}`
        : `${req.protocol}://${host}`;
      const expectedResource = `${baseUrl}/mcp`;
      
      if (resource !== expectedResource) {
        res.status(400).json({ 
          error: "invalid_request", 
          error_description: `Invalid resource parameter. Expected: ${expectedResource}` 
        });
        return;
      }
    }

    // Validate PKCE method
    if (code_challenge_method !== "S256") {
      res.status(400).json({ 
        error: "invalid_request", 
        error_description: "Unsupported code challenge method" 
      });
      return;
    }

    // Store PKCE challenge for later validation with expiration
    const stateParam = state as string || randomUUID();
    const now = Date.now();
    const expiresAt = now + (10 * 60 * 1000); // 10 minutes from now
    
    this.pkceStore.set(stateParam, {
      code_challenge: code_challenge as string,
      code_challenge_method: code_challenge_method as string,
      client_id: client_id as string,
      redirect_uri: redirect_uri as string,
      expiresAt,
      createdAt: now,
    });

    log(`Stored PKCE challenge for state ${stateParam}, expires at ${new Date(expiresAt).toISOString()}`);

    // Redirect to Google OAuth with client's redirect_uri (direct flow)
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.OAUTH_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(redirect_uri as string)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent("https://www.googleapis.com/auth/tagmanager.edit.containers https://www.googleapis.com/auth/tagmanager.manage.accounts https://www.googleapis.com/auth/tagmanager.readonly")}&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${stateParam}`;
    
    log(`OAuth authorization: redirecting to Google OAuth with client redirect_uri: ${redirect_uri}`);
    res.redirect(authUrl);
  };

  // OAuth callback endpoint - now unused in direct flow
  callback = async (req: Request, res: Response): Promise<void> => {
    res.status(404).json({ error: "Callback endpoint not used in direct OAuth flow" });
  };

  // Token endpoint - proxy to Google
  token = async (req: Request, res: Response): Promise<void> => {
    try {
      log(`Token request body: ${JSON.stringify(req.body)}`);
      
      const { code, grant_type, redirect_uri } = req.body;

      if (grant_type !== "authorization_code") {
        res.status(400).json({ error: "unsupported_grant_type" });
        return;
      }

      if (!code || !redirect_uri) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing authorization code or redirect_uri" });
        return;
      }

      // Exchange code for tokens with Google using client's redirect_uri (must match authorization)
      log(`Exchanging code with Google: ${code}, client_redirect_uri: ${redirect_uri}`);
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.OAUTH_CLIENT_ID!,
          client_secret: process.env.OAUTH_CLIENT_SECRET!,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirect_uri,
        }),
      });

      const tokens = await tokenResponse.json();
      log(`Google token response status: ${tokenResponse.status}`);
      log(`Google token response: ${JSON.stringify(tokens)}`);

      if (!tokenResponse.ok) {
        log(`Token exchange failed with Google: ${JSON.stringify(tokens)}`);
        res.status(tokenResponse.status).json(tokens);
        return;
      }

      // Store tokens for later use by tools
      const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);
      OAuthController.tokenStore.set(tokens.access_token, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expiresAt,
      });

      log(`Stored OAuth tokens for access_token: ${tokens.access_token.slice(0, 20)}...`);

      res.json({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
      });
    } catch (error) {
      log(`Token endpoint error: ${error}`);
      res.status(500).json({ error: "server_error" });
    }
  };

  // Auth status endpoint
  status = (req: Request, res: Response) => {
    res.json({
      authenticated: !!(process.env.GTM_ACCESS_TOKEN || process.env.GOOGLE_APPLICATION_CREDENTIALS),
      methods: ["oauth2", "service_account"],
    });
  };

  // Static method to get stored tokens
  static getStoredTokens(accessToken: string): TokenData | null {
    const tokenData = OAuthController.tokenStore.get(accessToken);
    if (!tokenData) {
      return null;
    }
    
    // Check if token is expired
    if (Date.now() > tokenData.expiresAt) {
      OAuthController.tokenStore.delete(accessToken);
      return null;
    }
    
    return tokenData;
  }
}
