import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { createErrorResponse } from "google-tag-manager-mcp-core";
import { TAG_MANAGER_REMOVE_MCP_SERVER_DATA } from "../constants/tools";
import { McpAgentPropsModel } from "../models/McpAgentModel";

export const removeMCPServerData = (
  server: McpServer,
  { props, oauth }: { props: McpAgentPropsModel; oauth: OAuthHelpers },
): void => {
  server.registerTool(
    TAG_MANAGER_REMOVE_MCP_SERVER_DATA,
    {
      description:
        "Sign this MCP client out of the GTM MCP server. Signs out every place this client is used (for a Claude connector, all Claude apps on the account; for mcp-remote, every process on this machine using this server). Other MCP clients of the same Google account stay signed in. Only call this when the user explicitly asks to sign out or to reset this connection.",
    },
    async () => {
      try {
        // Only this client's grants: the user's other clients (Desktop,
        // Cursor, ...) have their own and must stay signed in.
        let cursor: string | undefined;
        do {
          const page = await oauth.listUserGrants(props.userId, { cursor });
          await Promise.all(
            page.items
              .filter((grant) => grant.clientId === props.clientId)
              .map((grant) => oauth.revokeGrant(grant.id, grant.userId)),
          );
          cursor = page.cursor;
        } while (cursor);

        // Google doesn't document whether revoking one token drops the whole
        // app authorization, which the other clients rely on. So only revoke
        // once none of them is left.
        const remaining = await oauth.listUserGrants(props.userId, {
          limit: 1,
        });
        if (remaining.items.length === 0 && props.refreshToken) {
          await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: props.refreshToken }),
          }).catch((error) => {
            // Already signed out on our side; Google drops unused tokens.
            console.warn("[gtm_remove_session] Google revoke failed", error);
          });
        }
      } catch (error) {
        return createErrorResponse(
          `Error removing client in the ${TAG_MANAGER_REMOVE_MCP_SERVER_DATA} tool for client ${props.clientId}`,
          error,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: "Signed out of the GTM MCP server. The next GTM request asks the user to sign in with Google again (if nothing happens, restart or reconnect the MCP client). No local files need to be deleted.",
          },
        ],
      };
    },
  );
};
