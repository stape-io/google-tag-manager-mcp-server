import { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Implementation } from "@modelcontextprotocol/sdk/types.js";
import { tools as defaultTools } from "./tools/index.js";
import { GtmToolContext, GtmToolRegistration } from "./types/index.js";
import { PACKAGE_VERSION } from "./version.js";

export type CreateGtmMcpServerOptions = GtmToolContext & {
  serverInfo?: Partial<Implementation>;
  /** Replaces the default Google Tag Manager tool set. */
  tools?: GtmToolRegistration[];
  /** Registered on top of the tool set - e.g. server specific session tools. */
  extraTools?: GtmToolRegistration[];
  serverOptions?: ServerOptions;
};

/** For servers whose `McpServer` instance is owned by a framework. */
export function registerGtmTools(
  server: McpServer,
  context: GtmToolContext,
  registrations: GtmToolRegistration[] = defaultTools,
): McpServer {
  registrations.forEach((register) => register(server, context));
  return server;
}

export function createGtmMcpServer({
  auth,
  serverInfo,
  tools = defaultTools,
  extraTools = [],
  serverOptions,
}: CreateGtmMcpServerOptions): McpServer {
  const server = new McpServer(
    {
      name: "google-tag-manager-mcp-server",
      version: PACKAGE_VERSION,
      ...serverInfo,
    },
    serverOptions,
  );

  return registerGtmTools(server, { auth }, [...tools, ...extraTools]);
}
