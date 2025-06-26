import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { GtagConfigSchemaFields } from "../../schemas/GtagConfigSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$GtagConfig = tagmanager_v2.Schema$GtagConfig;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_gtag_config",
    "Updates a Google tag config",
    GtagConfigSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      gtagConfigId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_gtag_config for account ${accountId}, container ${containerId}, workspace ${workspaceId}, gtagConfig ${gtagConfigId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.gtag_config.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
            fingerprint,
            requestBody: rest as Schema$GtagConfig,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating Google tag config ${gtagConfigId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
