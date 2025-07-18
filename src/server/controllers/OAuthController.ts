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

export class OAuthController {
  private pkceStore = new Map<string, PkceData>();

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
      const expectedResource = `${req.protocol}://${req.get("host")}/mcp`;
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

    // Redirect to Google OAuth with client's redirect_uri
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

  // OAuth callback endpoint
  callback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        res.status(400).json({ error: "Missing authorization code or state" });
        return;
      }

      // Retrieve PKCE challenge from state
      const pkceData = this.pkceStore.get(state as string);
      if (!pkceData) {
        res.status(400).json({ error: "Invalid state parameter" });
        return;
      }

      // Check if PKCE challenge has expired
      if (Date.now() > pkceData.expiresAt) {
        this.pkceStore.delete(state as string);
        log(`PKCE challenge expired for state ${state}`);
        res.status(400).json({ error: "Authorization request expired" });
        return;
      }

      // Exchange code for tokens with Google
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.OAUTH_CLIENT_ID!,
          client_secret: process.env.OAUTH_CLIENT_SECRET!,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: `${req.protocol}://${req.get("host")}/oauth/callback`,
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok) {
        log(`Token exchange failed: ${JSON.stringify(tokens)}`);
        res.status(400).json({ error: "Token exchange failed", details: tokens });
        return;
      }

      // Clean up PKCE data
      this.pkceStore.delete(state as string);

      // Redirect back to client with authorization code
      const clientRedirectUrl = `${pkceData.redirect_uri}?code=${code}&state=${state}`;
      res.redirect(clientRedirectUrl);
    } catch (error) {
      log(`OAuth callback error: ${error}`);
      res.status(500).json({ error: "Internal server error" });
    }
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

      // Exchange code for tokens with Google using client's redirect_uri
      log(`Exchanging code with Google: ${code}, redirect_uri: ${redirect_uri}`);
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
}
