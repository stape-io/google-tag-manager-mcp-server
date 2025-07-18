import crypto from 'crypto';

export interface Session {
  sessionId: string;
  mcpClientId: string;
  mcpAccessToken: string;
  mcpRefreshToken?: string;
  thirdPartyAccessToken?: string;
  thirdPartyRefreshToken?: string;
  thirdPartyExpiresAt?: number;
  createdAt: number;
  expiresAt: number;
}

export interface AuthState {
  state: string;
  mcpClientId: string;
  redirectUri: string;
  originalState?: string; // Original state from MCP client
  codeVerifier?: string;
  createdAt: number;
}

export interface AuthorizationCode {
  code: string;
  mcpClientId: string;
  sessionId: string;
  createdAt: number;
}

// In-memory session store (in production, use Redis or database)
const sessions = new Map<string, Session>();
const authStates = new Map<string, AuthState>();
const authorizationCodes = new Map<string, AuthorizationCode>();

export class SessionManager {
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly STATE_DURATION = 10 * 60 * 1000; // 10 minutes
  private static readonly CODE_DURATION = 10 * 60 * 1000; // 10 minutes
  
  /**
   * Create a new session bound to an MCP client
   */
  static createSession(mcpClientId: string): Session {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const mcpAccessToken = crypto.randomBytes(32).toString('hex');
    const mcpRefreshToken = crypto.randomBytes(32).toString('hex');
    
    const session: Session = {
      sessionId,
      mcpClientId,
      mcpAccessToken,
      mcpRefreshToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.SESSION_DURATION
    };
    
    sessions.set(sessionId, session);
    return session;
  }
  
  /**
   * Get session by session ID
   */
  static getSession(sessionId: string): Session | undefined {
    const session = sessions.get(sessionId);
    if (!session) return undefined;
    
    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      sessions.delete(sessionId);
      return undefined;
    }
    
    return session;
  }
  
  /**
   * Get session by MCP access token
   */
  static getSessionByMcpToken(mcpAccessToken: string): Session | undefined {
    for (const session of sessions.values()) {
      if (session.mcpAccessToken === mcpAccessToken) {
        // Check if session is expired
        if (Date.now() > session.expiresAt) {
          sessions.delete(session.sessionId);
          return undefined;
        }
        return session;
      }
    }
    return undefined;
  }
  
  /**
   * Get session by MCP client ID
   */
  static getSessionByClientId(mcpClientId: string): Session | undefined {
    for (const session of sessions.values()) {
      if (session.mcpClientId === mcpClientId) {
        // Check if session is expired
        if (Date.now() > session.expiresAt) {
          sessions.delete(session.sessionId);
          return undefined;
        }
        return session;
      }
    }
    return undefined;
  }
  
  /**
   * Update session with third-party tokens
   */
  static updateSessionWithThirdPartyTokens(
    sessionId: string,
    accessToken: string,
    refreshToken?: string,
    expiresIn?: number
  ): boolean {
    const session = sessions.get(sessionId);
    if (!session) return false;
    
    session.thirdPartyAccessToken = accessToken;
    session.thirdPartyRefreshToken = refreshToken;
    session.thirdPartyExpiresAt = expiresIn ? Date.now() + (expiresIn * 1000) : undefined;
    
    sessions.set(sessionId, session);
    return true;
  }
  
  /**
   * Create auth state for OAuth flow
   */
  static createAuthState(mcpClientId: string, redirectUri: string, originalState?: string, codeVerifier?: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    
    const authState: AuthState = {
      state,
      mcpClientId,
      redirectUri,
      originalState,
      codeVerifier,
      createdAt: Date.now()
    };
    
    authStates.set(state, authState);
    return state;
  }
  
  /**
   * Get and consume auth state
   */
  static consumeAuthState(state: string): AuthState | undefined {
    const authState = authStates.get(state);
    if (!authState) return undefined;
    
    // Check if state is expired
    if (Date.now() > authState.createdAt + this.STATE_DURATION) {
      authStates.delete(state);
      return undefined;
    }
    
    // Consume the state (one-time use)
    authStates.delete(state);
    return authState;
  }
  
  /**
   * Create authorization code for token exchange
   */
  static createAuthorizationCode(code: string, mcpClientId: string, sessionId: string): void {
    const authCode: AuthorizationCode = {
      code,
      mcpClientId,
      sessionId,
      createdAt: Date.now()
    };
    
    authorizationCodes.set(code, authCode);
  }
  
  /**
   * Get and consume authorization code
   */
  static consumeAuthorizationCode(code: string): AuthorizationCode | undefined {
    const authCode = authorizationCodes.get(code);
    if (!authCode) return undefined;
    
    // Check if code is expired
    if (Date.now() > authCode.createdAt + this.CODE_DURATION) {
      authorizationCodes.delete(code);
      return undefined;
    }
    
    // Consume the code (one-time use)
    authorizationCodes.delete(code);
    return authCode;
  }
  
  /**
   * Clean up expired sessions and states
   */
  static cleanup(): void {
    const now = Date.now();
    
    // Clean up expired sessions
    for (const [sessionId, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        sessions.delete(sessionId);
      }
    }
    
    // Clean up expired auth states
    for (const [state, authState] of authStates.entries()) {
      if (now > authState.createdAt + this.STATE_DURATION) {
        authStates.delete(state);
      }
    }
    
    // Clean up expired authorization codes
    for (const [code, authCode] of authorizationCodes.entries()) {
      if (now > authCode.createdAt + this.CODE_DURATION) {
        authorizationCodes.delete(code);
      }
    }
  }
  
  /**
   * Get session statistics
   */
  static getStats(): { sessions: number; authStates: number; authorizationCodes: number } {
    return {
      sessions: sessions.size,
      authStates: authStates.size,
      authorizationCodes: authorizationCodes.size
    };
  }
}

// Start cleanup timer
setInterval(() => {
  SessionManager.cleanup();
}, 60 * 1000); // Run every minute