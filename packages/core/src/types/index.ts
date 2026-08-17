import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Called on every tool invocation: implementations cache and refresh internally. */
export interface GtmAuthProvider {
  getAccessToken(): Promise<string>;
}

export type GtmToolContext = {
  auth: GtmAuthProvider;
};

export type GtmToolRegistration = (
  server: McpServer,
  context: GtmToolContext,
) => void;
