import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { McpAgentPropsModel } from "./models/McpAgentModel";
import { tools } from "./tools";
import { apisHandler, getPackageVersion } from "./utils";

export class GoogleTagManagerMCPServer extends McpAgent<
  Env,
  null,
  McpAgentPropsModel
> {
  server = new McpServer({
    name: "google-tag-manager-mcp-server",
    version: getPackageVersion(),
    protocolVersion: "1.0",
    vendor: "stape-io",
    homepage: "https://github.com/stape-io/google-tag-manager-mcp-server",
  });

  async init() {
    tools.forEach((register) => {
      register(this.server, { props: this.props, env: this.env });
    });
  }
}

export default new OAuthProvider({
  apiRoute: "/sse",
  // @ts-ignore
  apiHandler: GoogleTagManagerMCPServer.mount("/sse"),
  // @ts-ignore
  defaultHandler: apisHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
