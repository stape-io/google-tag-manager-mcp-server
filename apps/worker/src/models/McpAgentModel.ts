export type McpAgentPropsModel = {
  userId: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId: string;
  /** Set when the request came in on gtm-mcp.stape.ai (see utils/hostNotice.ts). */
  oldHost?: true;
};
