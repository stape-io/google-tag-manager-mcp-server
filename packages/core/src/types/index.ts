import { McpServer } from "@modelcontextprotocol/server";
import type { GtmRuntime } from "../utils/createGtmRuntime.js";

/** Called on every tool invocation: implementations cache and refresh internally. */
export interface GtmAuthProvider {
  getAccessToken(): Promise<string>;
}

export type GtmToolContext = {
  auth: GtmAuthProvider;
  runtime?: GtmRuntime;
};

export type GtmToolRegistration = (
  server: McpServer,
  context: GtmToolContext,
) => void;
