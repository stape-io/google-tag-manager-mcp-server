import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { ZoneSchemaFields } from "../../schemas/ZoneSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Zone = tagmanager_v2.Schema$Zone;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_zone",
    "Updates a GTM Zone",
    ZoneSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      zoneId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_zone for account ${accountId}, container ${containerId}, workspace ${workspaceId}, zone ${zoneId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.zones.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
            fingerprint,
            requestBody: rest as Schema$Zone,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating zone ${zoneId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
