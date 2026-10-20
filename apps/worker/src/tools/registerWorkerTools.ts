import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  type GtmAuthProvider,
  registerGtmTools,
} from "google-tag-manager-mcp-core";
import { McpAgentPropsModel } from "../models/McpAgentModel";
import {
  hostNoticeInstructions,
  showsHostNotice,
  withHostNotice,
} from "../utils/hostNotice";
import { removeMCPServerData } from "./removeMCPServerData";

/**
 * Constructor options for the `McpServer` of either route (`/mcp` and `/sse`):
 * the old host's server carries the notice in its `instructions`.
 */
export function hostNoticeServerOptions(
  env: Env,
): { instructions: string } | undefined {
  return showsHostNotice(env)
    ? { instructions: hostNoticeInstructions() }
    : undefined;
}

/**
 * Registers everything the worker serves, the same way for `/mcp` and `/sse`,
 * so the old-host behavior (notice wrapper, no Google revoke on sign-out)
 * can't be set up on one route and missed on the other.
 */
export function registerWorkerTools(
  server: McpServer,
  env: Env,
  {
    auth,
    props,
    oauth,
  }: {
    auth: GtmAuthProvider;
    props: McpAgentPropsModel;
    oauth: OAuthHelpers;
  },
): void {
  const oldHost = showsHostNotice(env);
  const target = oldHost ? withHostNotice(server) : server;

  registerGtmTools(target, { auth });
  removeMCPServerData(target, { props, oauth, oldHost });
}
