import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { log } from '../utils';
import { runWithAuthContext, parseAuthorizationHeader } from '../utils/authContext';
import { SessionManager } from '../utils/sessionManager';
import crypto from 'crypto';

interface RegisteredClient {
  client_id: string;
  client_secret: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  client_id_issued_at: number;
  client_secret_expires_at: number;
  created_at: number;
}

/**
 * Server transport for HTTP: this communicates with MCP clients over HTTP.
 */
export class HttpServerTransport {
  private app: express.Application;
  private server: any;
  private port: number;
  private started: boolean = false;

  // Event handlers
  public onmessage?: (message: any) => void;
  public onerror?: (error: Error) => void;
  public onclose?: () => void;
  
  // Store pending requests for HTTP responses
  private pendingRequests: Map<string, express.Response> = new Map();
  
  // Dynamic client registry
  private registeredClients: Map<string, RegisteredClient> = new Map();

  constructor(port = process.env.PORT ? parseInt(process.env.PORT) : 3000) {
    this.port = port;
    this.app = express();
    
    // Start cleanup timer for expired clients
    this.startClientCleanup();
    
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Enable CORS for remote access
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Cache-Control, mcp-protocol-version');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
    
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).send({ status: 'ok', transports: ['http', 'sse'] });
    });

    // OAuth2 authentication endpoints
    this.setupOAuth2Routes();

    // OAuth2 discovery endpoints for MCP Inspector
    this.setupOAuth2Discovery();
    
    // OAuth protected resource endpoints for MCP Inspector
    this.setupOAuthProtectedResourceEndpoints();
    
    // SSE clients storage
    this.clients = new Map();
  }

  private clients: Map<string, express.Response> = new Map();

  /**
   * Sets up OAuth2 authentication routes for Google Tag Manager API
   */
  private setupOAuth2Routes(): void {
    // OAuth2 scopes for Google Tag Manager API
    const SCOPES = [
      'https://www.googleapis.com/auth/tagmanager.readonly',
      'https://www.googleapis.com/auth/tagmanager.edit.containers',
      'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
      'https://www.googleapis.com/auth/tagmanager.manage.accounts',
      'https://www.googleapis.com/auth/tagmanager.manage.users',
      'https://www.googleapis.com/auth/tagmanager.publish',
      'https://www.googleapis.com/auth/tagmanager.delete.containers'
    ];

    // OAuth2 authorization endpoint - implements MCP third-party authorization flow
    this.app.get('/auth', (req: any, res: any) => {
      if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
        return res.status(400).json({
          error: 'OAuth2 not configured',
          message: 'OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables must be set'
        });
      }

      const client_id = req.query.client_id;
      const redirect_uri = req.query.redirect_uri;
      const state = req.query.state;
      const code_challenge = req.query.code_challenge;
      const code_challenge_method = req.query.code_challenge_method;
      
      log(`Auth request: client_id=${client_id}, redirect_uri=${redirect_uri}, state=${state}`);
      
      // MCP Third-Party Authorization Flow
      if (client_id && redirect_uri) {
        // Step 1: Validate registered MCP client
        const registeredClient = this.registeredClients.get(client_id as string);
        if (!registeredClient) {
          return res.status(400).json({
            error: 'invalid_client',
            error_description: 'Client not found'
          });
        }
        
        // Validate redirect_uri
        if (!registeredClient.redirect_uris.includes(redirect_uri as string)) {
          return res.status(400).json({
            error: 'invalid_redirect_uri',
            error_description: 'Redirect URI not registered for this client'
          });
        }
        
        // Step 2: Create session for this MCP client
        const session = SessionManager.createSession(client_id as string);
        
        // Step 3: Generate state that includes session info for callback
        const authState = SessionManager.createAuthState(
          client_id as string,
          redirect_uri as string,
          state ? state as string : undefined, // Original state from MCP client
          code_challenge as string
        );
        
        // Step 4: Redirect to third-party authorization server (Google)
        const host = req.get('host');
        const baseUrl = (host?.includes('run.app') || process.env.NODE_ENV === 'production') 
          ? `https://${host}` 
          : `${req.protocol}://${host}`;
        
        const oauth2Client = new google.auth.OAuth2(
          process.env.OAUTH_CLIENT_ID,
          process.env.OAUTH_CLIENT_SECRET,
          `${baseUrl}/auth/callback`
        );

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
          prompt: 'consent',
          response_type: 'code',
          state: authState // Use our internal state for callback
        });

        log(`Redirecting to Google OAuth with state: ${authState}`);
        res.redirect(authUrl);
      } else {
        // Legacy direct authorization (for browser testing)
        const oauth2Client = new google.auth.OAuth2(
          process.env.OAUTH_CLIENT_ID,
          process.env.OAUTH_CLIENT_SECRET,
          process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/callback`
        );

        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
          prompt: 'consent',
          response_type: 'code',
          state: state as string
        });

        // For API clients, return the auth URL
        if (req.headers.accept?.includes('application/json')) {
          res.json({ authUrl });
        } else {
          // For browser clients, redirect to Google OAuth
          res.redirect(authUrl);
        }
      }
    });

    // OAuth2 callback endpoint - handles third-party authorization callback
    this.app.get('/auth/callback', async (req: any, res: any) => {
      const { code, error, state } = req.query;

      if (error) {
        return res.status(400).json({
          error: 'OAuth2 authorization failed',
          message: error
        });
      }

      if (!code) {
        return res.status(400).json({
          error: 'Authorization code missing',
          message: 'No authorization code received from Google'
        });
      }

      try {
        // Check if this is part of MCP third-party authorization flow
        if (state) {
          const authState = SessionManager.consumeAuthState(state as string);
          
          if (authState) {
            // This is MCP third-party authorization flow
            log(`Processing MCP third-party auth callback for client: ${authState.mcpClientId}`);
            
            // Step 5: Exchange authorization code for Google tokens
            const host = req.get('host');
            const baseUrl = (host?.includes('run.app') || process.env.NODE_ENV === 'production') 
              ? `https://${host}` 
              : `${req.protocol}://${host}`;
            
            const oauth2Client = new google.auth.OAuth2(
              process.env.OAUTH_CLIENT_ID,
              process.env.OAUTH_CLIENT_SECRET,
              `${baseUrl}/auth/callback`
            );

            const { tokens } = await oauth2Client.getToken(code as string);
            
            log(`Received Google tokens for MCP client: ${authState.mcpClientId}`);
            
            // Step 6: Find the session and bind Google tokens to it
            const session = SessionManager.getSessionByClientId(authState.mcpClientId);
            if (!session) {
              throw new Error('Session not found');
            }
            
            // Update session with Google tokens
            const expiresIn = tokens.expiry_date ? 
              Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600;
              
            SessionManager.updateSessionWithThirdPartyTokens(
              session.sessionId,
              tokens.access_token!,
              tokens.refresh_token || undefined,
              expiresIn
            );
            
            // Step 7: Generate MCP authorization code for the client
            const mcpAuthCode = crypto.randomBytes(32).toString('hex');
            
            // Store the authorization code temporarily (for token exchange)
            SessionManager.createAuthorizationCode(
              mcpAuthCode,
              authState.mcpClientId,
              session.sessionId
            );
            
            // Step 8: Redirect back to MCP client with authorization code
            const redirectUrl = new URL(authState.redirectUri);
            redirectUrl.searchParams.set('code', mcpAuthCode);
            if (authState.originalState) {
              redirectUrl.searchParams.set('state', authState.originalState);
            }
            
            log(`Redirecting MCP client to: ${redirectUrl.toString()}`);
            res.redirect(redirectUrl.toString());
            
          } else {
            throw new Error('Invalid or expired authorization state');
          }
        } else {
          // Legacy direct authorization (for browser testing)
          const oauth2Client = new google.auth.OAuth2(
            process.env.OAUTH_CLIENT_ID,
            process.env.OAUTH_CLIENT_SECRET,
            process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/callback`
          );

          const { tokens } = await oauth2Client.getToken(code as string);
          
          res.json({
            message: 'Authorization successful',
            tokens: {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              scope: tokens.scope,
              token_type: tokens.token_type,
              expiry_date: tokens.expiry_date
            },
            instructions: {
              message: 'Save these tokens to your environment variables:',
              env_vars: {
                GTM_ACCESS_TOKEN: tokens.access_token,
                GTM_REFRESH_TOKEN: tokens.refresh_token
              }
            }
          });
        }
      } catch (error) {
        log(`OAuth2 callback error: ${error}`);
        res.status(500).json({
          error: 'Authorization callback failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Token refresh endpoint
    this.app.post('/auth/refresh', async (req: any, res: any) => {
      if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET || !process.env.GTM_REFRESH_TOKEN) {
        return res.status(400).json({
          error: 'OAuth2 not configured',
          message: 'OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, and GTM_REFRESH_TOKEN environment variables must be set'
        });
      }

      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.OAUTH_CLIENT_ID,
          process.env.OAUTH_CLIENT_SECRET,
          process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
        );

        oauth2Client.setCredentials({
          refresh_token: process.env.GTM_REFRESH_TOKEN
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        res.json({
          message: 'Token refreshed successfully',
          tokens: {
            access_token: credentials.access_token,
            expiry_date: credentials.expiry_date
          }
        });
      } catch (error) {
        log(`Token refresh error: ${error}`);
        res.status(500).json({
          error: 'Token refresh failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // OAuth2 status endpoint
    this.app.get('/auth/status', (req: any, res: any) => {
      const hasServiceAccount = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GTM_SERVICE_ACCOUNT_KEY_PATH);
      const hasOAuth2Config = !!(process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET);
      const hasOAuth2Tokens = !!(process.env.GTM_ACCESS_TOKEN || process.env.GTM_REFRESH_TOKEN);

      res.json({
        authentication: {
          service_account: {
            configured: hasServiceAccount,
            env_var: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'GOOGLE_APPLICATION_CREDENTIALS' : 
                    process.env.GTM_SERVICE_ACCOUNT_KEY_PATH ? 'GTM_SERVICE_ACCOUNT_KEY_PATH' : null
          },
          oauth2: {
            configured: hasOAuth2Config,
            has_tokens: hasOAuth2Tokens,
            missing_config: !hasOAuth2Config ? ['OAUTH_CLIENT_ID', 'OAUTH_CLIENT_SECRET'] : null,
            missing_tokens: hasOAuth2Config && !hasOAuth2Tokens ? ['GTM_ACCESS_TOKEN or GTM_REFRESH_TOKEN'] : null
          }
        },
        active_method: hasOAuth2Config && hasOAuth2Tokens ? 'oauth2' : 
                      hasServiceAccount ? 'service_account' : 'none'
      });
    });
  }

  /**
   * Sets up OAuth2 discovery endpoints for MCP Inspector
   */
  private setupOAuth2Discovery(): void {
    // OAuth2 discovery endpoint
    this.app.get('/.well-known/oauth-authorization-server', (req, res) => {
      const host = req.get('host');
      
      // For production (Cloud Run), always use https
      const baseUrl = (host?.includes('run.app') || process.env.NODE_ENV === 'production') 
        ? `https://${host}` 
        : `${req.protocol}://${host}`;
        
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'client_credentials'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: [
          'https://www.googleapis.com/auth/tagmanager.readonly',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts',
          'https://www.googleapis.com/auth/tagmanager.manage.users',
          'https://www.googleapis.com/auth/tagmanager.publish',
          'https://www.googleapis.com/auth/tagmanager.delete.containers'
        ]
      });
    });

    // Token endpoint for OAuth2 flow - completes MCP third-party authorization
    this.app.post('/auth/token', async (req: any, res: any) => {
      if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'OAuth2 not configured'
        });
      }

      try {
        const { code, client_id, client_secret, redirect_uri, grant_type, code_verifier } = req.body;
        
        log(`MCP token exchange request: client_id=${client_id}, grant_type=${grant_type}, has_code=${!!code}, has_code_verifier=${!!code_verifier}`);

        // Validate client credentials
        const registeredClient = this.registeredClients.get(client_id);
        if (!registeredClient) {
          return res.status(400).json({
            error: 'invalid_client',
            error_description: 'Client not found'
          });
        }

        if (registeredClient.client_secret !== client_secret) {
          return res.status(400).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials'
          });
        }

        // Check if client has expired
        if (registeredClient.client_secret_expires_at > 0 && 
            registeredClient.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
          return res.status(400).json({
            error: 'invalid_client',
            error_description: 'Client credentials have expired'
          });
        }

        if (grant_type !== 'authorization_code') {
          return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only authorization_code grant type is supported'
          });
        }

        // Exchange MCP authorization code for session
        const authCode = SessionManager.consumeAuthorizationCode(code);
        if (!authCode) {
          log(`Authorization code not found or expired: ${code}`);
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid or expired authorization code'
          });
        }
        
        log(`Found authorization code for client: ${authCode.mcpClientId}, session: ${authCode.sessionId}`);

        // Validate that the client_id matches the authorization code
        if (authCode.mcpClientId !== client_id) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Authorization code was issued to a different client'
          });
        }

        // Get the session with bound Google tokens
        const session = SessionManager.getSession(authCode.sessionId);
        if (!session) {
          log(`Session not found or expired: ${authCode.sessionId}`);
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Session not found or expired'
          });
        }
        
        log(`Found session: ${session.sessionId}, has third-party token: ${!!session.thirdPartyAccessToken}`);

        // Check if session has third-party tokens
        if (!session.thirdPartyAccessToken) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Third-party authorization incomplete'
          });
        }

        // Calculate token expiration
        const expiresIn = session.thirdPartyExpiresAt ? 
          Math.floor((session.thirdPartyExpiresAt - Date.now()) / 1000) : 3600;

        log(`MCP token exchange successful for client: ${client_id}`);
        
        // Return MCP tokens bound to the Google session
        res.json({
          access_token: session.mcpAccessToken,
          refresh_token: session.mcpRefreshToken,
          expires_in: expiresIn,
          token_type: 'Bearer',
          scope: registeredClient.scope
        });
      } catch (error) {
        log('MCP token exchange failed:', error);
        res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Token exchange failed'
        });
      }
    });

    // OAuth endpoints for Claude Desktop compatibility
    this.app.post('/oauth/register', (req: any, res: any) => {
      // Same logic as /auth/register
      this.handleClientRegistration(req, res);
    });
    
    this.app.get('/oauth/authorize', (req: any, res: any) => {
      // Same logic as /auth
      this.handleAuthorization(req, res);
    });
    
    this.app.post('/oauth/token', async (req: any, res: any) => {
      // Same logic as /auth/token
      this.handleTokenExchange(req, res);
    });

    // Legacy endpoints (keep for backward compatibility)
    this.app.post('/auth/register', (req: any, res: any) => {
      this.handleClientRegistration(req, res);
    });
    
    this.app.get('/auth', (req: any, res: any) => {
      this.handleAuthorization(req, res);
    });
    
    this.app.post('/auth/token', async (req: any, res: any) => {
      this.handleTokenExchange(req, res);
    });
  }

  /**
   * Sets up OAuth protected resource endpoints per RFC 8693
   */
  private setupOAuthProtectedResourceEndpoints(): void {
    // Helper function to determine the correct protocol and base URL
    const getBaseUrl = (req: express.Request): string => {
      const host = req.get('host');
      
      // For production (Cloud Run), always use https
      if (host?.includes('run.app') || process.env.NODE_ENV === 'production') {
        return `https://${host}`;
      }
      
      // For local development, use the actual protocol from the request
      const protocol = req.protocol;
      return `${protocol}://${host}`;
    };

    // OAuth protected resource discovery endpoint
    this.app.get('/.well-known/oauth-protected-resource', (req, res) => {
      const baseUrl = getBaseUrl(req);
      res.json({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [`${baseUrl}/.well-known/oauth-authorization-server`],
        scopes_supported: [
          'https://www.googleapis.com/auth/tagmanager.readonly',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts',
          'https://www.googleapis.com/auth/tagmanager.manage.users',
          'https://www.googleapis.com/auth/tagmanager.publish',
          'https://www.googleapis.com/auth/tagmanager.delete.containers'
        ],
        bearer_methods_supported: ['header', 'body'],
        resource_documentation: `${baseUrl}/docs`
      });
    });

    // OAuth protected resource MCP endpoint
    this.app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
      const baseUrl = getBaseUrl(req);
      res.json({
        resource: `${baseUrl}/mcp`,
        authorization_servers: [`${baseUrl}/.well-known/oauth-authorization-server`],
        scopes_required: [
          'https://www.googleapis.com/auth/tagmanager.readonly',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts'
        ],
        bearer_methods_supported: ['header'],
        resource_documentation: `${baseUrl}/docs`
      });
    });

  }

  /**
   * Handler for client registration (both /auth/register and /oauth/register)
   */
  private handleClientRegistration(req: any, res: any): void {
    if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'OAuth2 not configured'
      });
    }

    try {
      // Generate unique client credentials
      const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;
      const clientSecret = crypto.randomBytes(32).toString('hex');
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + (7 * 24 * 60 * 60); // 7 days from now
      
      // Parse registration request
      const registrationData = req.body || {};
      const redirect_uris = registrationData.redirect_uris || [
        `${req.protocol}://${req.get('host')}/auth/callback`
      ];
      
      // Create registered client
      const registeredClient: RegisteredClient = {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uris,
        grant_types: registrationData.grant_types || ['authorization_code', 'refresh_token'],
        response_types: registrationData.response_types || ['code'],
        scope: registrationData.scope || 'https://www.googleapis.com/auth/tagmanager.readonly https://www.googleapis.com/auth/tagmanager.edit.containers https://www.googleapis.com/auth/tagmanager.edit.containerversions https://www.googleapis.com/auth/tagmanager.manage.accounts https://www.googleapis.com/auth/tagmanager.manage.users https://www.googleapis.com/auth/tagmanager.publish https://www.googleapis.com/auth/tagmanager.delete.containers',
        client_id_issued_at: issuedAt,
        client_secret_expires_at: expiresAt,
        created_at: Date.now()
      };
      
      // Store the registered client
      this.registeredClients.set(clientId, registeredClient);
      
      log(`Dynamic client registered: ${clientId}`);
      
      // Return registration response according to RFC 7591
      res.json({
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: issuedAt,
        client_secret_expires_at: expiresAt,
        redirect_uris: redirect_uris,
        grant_types: registeredClient.grant_types,
        response_types: registeredClient.response_types,
        scope: registeredClient.scope,
        token_endpoint_auth_method: 'client_secret_post'
      });
      
    } catch (error) {
      log(`Dynamic client registration failed: ${error}`);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to register client'
      });
    }
  }

  /**
   * Handler for authorization (both /auth and /oauth/authorize)
   */
  private handleAuthorization(req: any, res: any): void {
    if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'OAuth2 not configured',
        message: 'OAUTH_CLIENT_ID and OAUTH_CLIENT_SECRET environment variables must be set'
      });
    }

    const client_id = req.query.client_id;
    const redirect_uri = req.query.redirect_uri;
    const state = req.query.state;
    const code_challenge = req.query.code_challenge;
    const code_challenge_method = req.query.code_challenge_method;
    
    log(`Auth request: client_id=${client_id}, redirect_uri=${redirect_uri}, state=${state}`);
    
    // MCP Third-Party Authorization Flow
    if (client_id && redirect_uri) {
      // Step 1: Validate registered MCP client
      const registeredClient = this.registeredClients.get(client_id as string);
      if (!registeredClient) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not found'
        });
      }
      
      // Validate redirect_uri
      if (!registeredClient.redirect_uris.includes(redirect_uri as string)) {
        return res.status(400).json({
          error: 'invalid_redirect_uri',
          error_description: 'Redirect URI not registered for this client'
        });
      }
      
      // Step 2: Create session for this MCP client
      const session = SessionManager.createSession(client_id as string);
      
      // Step 3: Generate state that includes session info for callback
      const authState = SessionManager.createAuthState(
        client_id as string,
        redirect_uri as string,
        state ? state as string : undefined, // Original state from MCP client
        code_challenge as string
      );
      
      // Step 4: Redirect to third-party authorization server (Google)
      const host = req.get('host');
      const baseUrl = (host?.includes('run.app') || process.env.NODE_ENV === 'production') 
        ? `https://${host}` 
        : `${req.protocol}://${host}`;
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET,
        `${baseUrl}/auth/callback`
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/tagmanager.readonly',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts',
          'https://www.googleapis.com/auth/tagmanager.manage.users',
          'https://www.googleapis.com/auth/tagmanager.publish',
          'https://www.googleapis.com/auth/tagmanager.delete.containers'
        ],
        prompt: 'consent',
        response_type: 'code',
        state: authState // Use our internal state for callback
      });

      log(`Redirecting to Google OAuth with state: ${authState}`);
      res.redirect(authUrl);
    } else {
      // Legacy direct authorization (for browser testing)
      const oauth2Client = new google.auth.OAuth2(
        process.env.OAUTH_CLIENT_ID,
        process.env.OAUTH_CLIENT_SECRET,
        process.env.OAUTH_REDIRECT_URI || `${req.protocol}://${req.get('host')}/auth/callback`
      );

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/tagmanager.readonly',
          'https://www.googleapis.com/auth/tagmanager.edit.containers',
          'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
          'https://www.googleapis.com/auth/tagmanager.manage.accounts',
          'https://www.googleapis.com/auth/tagmanager.manage.users',
          'https://www.googleapis.com/auth/tagmanager.publish',
          'https://www.googleapis.com/auth/tagmanager.delete.containers'
        ],
        prompt: 'consent',
        response_type: 'code',
        state: state as string
      });

      // For API clients, return the auth URL
      if (req.headers.accept?.includes('application/json')) {
        res.json({ authUrl });
      } else {
        // For browser clients, redirect to Google OAuth
        res.redirect(authUrl);
      }
    }
  }

  /**
   * Handler for token exchange (both /auth/token and /oauth/token)
   */
  private async handleTokenExchange(req: any, res: any): Promise<void> {
    if (!process.env.OAUTH_CLIENT_ID || !process.env.OAUTH_CLIENT_SECRET) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'OAuth2 not configured'
      });
    }

    try {
      const { code, client_id, client_secret, redirect_uri, grant_type, code_verifier } = req.body;
      
      log(`MCP token exchange request: client_id=${client_id}, grant_type=${grant_type}, has_code=${!!code}, has_code_verifier=${!!code_verifier}`);

      // Validate client credentials
      const registeredClient = this.registeredClients.get(client_id);
      if (!registeredClient) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not found'
        });
      }

      if (registeredClient.client_secret !== client_secret) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials'
        });
      }

      // Check if client has expired
      if (registeredClient.client_secret_expires_at > 0 && 
          registeredClient.client_secret_expires_at < Math.floor(Date.now() / 1000)) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client credentials have expired'
        });
      }

      if (grant_type !== 'authorization_code') {
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Only authorization_code grant type is supported'
        });
      }

      // Exchange MCP authorization code for session
      const authCode = SessionManager.consumeAuthorizationCode(code);
      if (!authCode) {
        log(`Authorization code not found or expired: ${code}`);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code'
        });
      }
      
      log(`Found authorization code for client: ${authCode.mcpClientId}, session: ${authCode.sessionId}`);

      // Validate that the client_id matches the authorization code
      if (authCode.mcpClientId !== client_id) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code was issued to a different client'
        });
      }

      // Get the session with bound Google tokens
      const session = SessionManager.getSession(authCode.sessionId);
      if (!session) {
        log(`Session not found or expired: ${authCode.sessionId}`);
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Session not found or expired'
        });
      }
      
      log(`Found session: ${session.sessionId}, has third-party token: ${!!session.thirdPartyAccessToken}`);

      // Check if session has third-party tokens
      if (!session.thirdPartyAccessToken) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Third-party authorization incomplete'
        });
      }

      // Calculate token expiration
      const expiresIn = session.thirdPartyExpiresAt ? 
        Math.floor((session.thirdPartyExpiresAt - Date.now()) / 1000) : 3600;

      log(`MCP token exchange successful for client: ${client_id}`);
      
      // Return MCP tokens bound to the Google session
      res.json({
        access_token: session.mcpAccessToken,
        refresh_token: session.mcpRefreshToken,
        expires_in: expiresIn,
        token_type: 'Bearer',
        scope: registeredClient.scope
      });
    } catch (error) {
      log('MCP token exchange failed:', error);
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Token exchange failed'
      });
    }
  }

  /**
   * Starts periodic cleanup of expired clients
   */
  private startClientCleanup(): void {
    setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let cleanedCount = 0;
      
      for (const [clientId, client] of this.registeredClients) {
        if (client.client_secret_expires_at > 0 && client.client_secret_expires_at < now) {
          this.registeredClients.delete(clientId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        log(`Cleaned up ${cleanedCount} expired OAuth2 clients`);
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Starts the HTTP server and begins listening for messages.
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error("HttpServerTransport already started! If using Server class, note that connect() calls start() automatically.");
    }

    // Set up the MCP endpoint - handles both POST (JSON-RPC) and GET (SSE)
    this.app.get('/mcp', (req, res) => {
      const clientId = Math.random().toString(36).substring(7);
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Store client connection
      this.clients.set(clientId, res);
      log(`SSE client connected: ${clientId}`);

      // Don't send initial connection event - MCP Inspector expects only JSON-RPC messages

      // Handle client disconnect
      req.on('close', () => {
        this.clients.delete(clientId);
        log(`SSE client disconnected: ${clientId}`);
      });

      req.on('error', (error) => {
        log(`SSE client error: ${error.message}`);
        this.clients.delete(clientId);
      });
    });

    this.app.post('/mcp', async (req, res) => {
      try {
        const message = req.body;
        const acceptHeader = req.headers.accept || '';
        
        log(`MCP POST request - Accept: ${acceptHeader}, Message: ${JSON.stringify(message)}`);
        
        if (!this.onmessage) {
          throw new Error('No message handler registered');
        }
        
        // Extract authorization from request headers per MCP spec
        const authHeader = req.headers.authorization;
        const authContext = parseAuthorizationHeader(authHeader);
        
        log(`Authorization header: ${authHeader ? 'present' : 'missing'}`);
        
        // Allow MCP protocol initialization without authorization, but require auth for tool calls
        const isInitializeRequest = message.method === 'initialize' || message.method === 'notifications/initialized';
        
        if (!authContext && !isInitializeRequest) {
          log(`Unauthorized request ${message.id} - no authorization header for ${message.method}`);
          res.status(401).set({
            'WWW-Authenticate': 'Bearer realm="MCP"'
          }).json({
            error: 'unauthorized',
            message: 'Authorization required for this resource'
          });
          return;
        }
        
        // Validate the MCP token exists in our session store (only for authenticated requests)
        if (authContext && authContext.accessToken) {
          const session = SessionManager.getSessionByMcpToken(authContext.accessToken);
          const stats = SessionManager.getStats();
          log(`MCP token validation - Token: ${authContext.accessToken?.substring(0, 8)}..., Session found: ${!!session}, Total sessions: ${stats.sessions}`);
          
          if (!session) {
            log(`Invalid MCP token ${authContext.accessToken?.substring(0, 8)}... - session not found`);
            res.status(401).set({
              'WWW-Authenticate': 'Bearer realm="MCP"'
            }).json({
              error: 'unauthorized',
              message: 'Invalid authorization'
            });
            return;
          }
        }
        
        // Store the response object to send reply later
        if (message.id !== undefined && message.id !== null) {
          this.pendingRequests.set(message.id.toString(), res);
        }
        
        // Process the message through the onmessage handler with auth context
        if (authContext) {
          log(`Processing request ${message.id} with authorization context`);
          runWithAuthContext(authContext, () => {
            this.onmessage!(message);
          });
        } else {
          log(`Processing request ${message.id} without authorization context (${message.method})`);
          this.onmessage(message);
        }
        
        // If no ID (undefined or null), this is a notification - send 202 Accepted per MCP spec
        if (message.id === undefined || message.id === null) {
          log(`Sending 202 Accepted for notification`);
          res.status(202).end();
        } else {
          log(`Request has ID: ${message.id}, waiting for response`);
        }
      } catch (error) {
        log(`Error processing request: ${error}`);
        if (this.onerror && error instanceof Error) {
          this.onerror(error);
        }
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // POST endpoint for receiving messages from SSE clients
    this.app.post('/message', async (req, res) => {
      try {
        const message = req.body;
        
        if (!this.onmessage) {
          throw new Error('No message handler registered');
        }
        
        log(`Received SSE message: ${JSON.stringify(message)}`);
        
        // Extract authorization from request headers per MCP spec
        const authHeader = req.headers.authorization;
        const authContext = parseAuthorizationHeader(authHeader);
        
        log(`SSE Authorization header: ${authHeader ? 'present' : 'missing'}`);
        
        // For MCP Third-Party Authorization Flow, require authorization for all requests
        if (!authContext) {
          log(`Unauthorized SSE request ${message.id} - no authorization header`);
          res.status(401).set({
            'WWW-Authenticate': 'Bearer realm="MCP"'
          }).json({
            error: 'unauthorized',
            message: 'Authorization required for this resource'
          });
          return;
        }
        
        // Validate the MCP token exists in our session store
        if (authContext.accessToken) {
          const session = SessionManager.getSessionByMcpToken(authContext.accessToken);
          log(`SSE MCP token validation - Token: ${authContext.accessToken?.substring(0, 8)}..., Session found: ${!!session}`);
          
          if (!session) {
            log(`Invalid SSE MCP token ${authContext.accessToken?.substring(0, 8)}... - session not found`);
            res.status(401).set({
              'WWW-Authenticate': 'Bearer realm="MCP"'
            }).json({
              error: 'unauthorized',
              message: 'Invalid authorization'
            });
            return;
          }
        }
        
        // Store the message ID for response routing via SSE
        if (message.id) {
          // Mark this as an SSE request for response routing
          message._sseRequest = true;
        }
        
        // Process the message through the onmessage handler with auth context
        log(`Processing SSE request ${message.id} with authorization context`);
        runWithAuthContext(authContext, () => {
          this.onmessage!(message);
        });
        
        // For SSE, acknowledge receipt but response will come via SSE stream
        res.status(200).json({ status: 'received' });
      } catch (error) {
        log(`Error processing SSE message: ${error}`);
        if (this.onerror && error instanceof Error) {
          this.onerror(error);
        }
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Start the server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        log(`HTTP server listening on port ${this.port}`);
        this.started = true;
        resolve();
      });
    });
  }

  /**
   * Closes the HTTP server.
   */
  async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server.close((err: Error) => {
          if (err) {
            if (this.onerror) {
              this.onerror(err);
            }
            reject(err);
          } else {
            log('HTTP server closed');
            if (this.onclose) {
              this.onclose();
            }
            resolve();
          }
        });
      });
    }
  }

  /**
   * Sends a message to connected clients via HTTP response or SSE.
   */
  async send(message: any): Promise<void> {
    const messageStr = JSON.stringify(message);
    
    // Handle HTTP responses for requests with IDs
    if (message.id !== undefined && message.id !== null && this.pendingRequests.has(message.id.toString())) {
      const res = this.pendingRequests.get(message.id.toString())!;
      this.pendingRequests.delete(message.id.toString());
      
      try {
        res.status(200).json(message);
        log(`Sent HTTP response for request ID: ${message.id}`);
        return Promise.resolve();
      } catch (error) {
        log(`Error sending HTTP response: ${error}`);
      }
    }
    
    // Send to SSE clients if any are connected
    if (this.clients.size > 0) {
      const disconnectedClients: string[] = [];
      for (const [clientId, res] of this.clients) {
        try {
          res.write(`data: ${messageStr}\n\n`);
        } catch (error) {
          log(`Error sending to SSE client ${clientId}: ${error}`);
          disconnectedClients.push(clientId);
        }
      }

      // Clean up disconnected clients
      disconnectedClients.forEach(clientId => {
        this.clients.delete(clientId);
      });

      log(`Sent message to ${this.clients.size} SSE clients`);
    } else if (message.id === undefined || message.id === null || !this.pendingRequests.has(message.id.toString())) {
      log(`No clients connected, message: ${messageStr}`);
    }
    
    return Promise.resolve();
  }
}