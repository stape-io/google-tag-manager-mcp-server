import { McpServer } from "@modelcontextprotocol/server";

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
