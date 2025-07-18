import { AsyncLocalStorage } from 'async_hooks';

// Authorization context for MCP requests
export interface AuthContext {
  authorization?: string;
  accessToken?: string;
  refreshToken?: string;
}

// AsyncLocalStorage for request-scoped authorization context
const authContextStorage = new AsyncLocalStorage<AuthContext>();

export function setAuthContext(context: AuthContext): void {
  // This will be called within the context of runWithAuthContext
  authContextStorage.enterWith(context);
}

export function getAuthContext(): AuthContext | undefined {
  return authContextStorage.getStore();
}

export function runWithAuthContext<T>(context: AuthContext, fn: () => T): T {
  return authContextStorage.run(context, fn);
}

export function parseAuthorizationHeader(authorization?: string): AuthContext | undefined {
  if (!authorization) {
    return undefined;
  }

  // Handle Bearer token format
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/);
  if (bearerMatch) {
    return {
      authorization,
      accessToken: bearerMatch[1]
    };
  }

  // Handle other token formats if needed
  return {
    authorization
  };
}