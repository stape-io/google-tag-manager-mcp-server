export type McpAgentPropsModel = {
  userId: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId: string;
};
