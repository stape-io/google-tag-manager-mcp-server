import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_delete_gtag_config",
    "Deletes a Google tag config",
    {
      accountId: z.string().describe("The GTM account ID"),
      containerId: z.string().describe("The container ID"),
      workspaceId: z.string().describe("The workspace ID"),
      gtagConfigId: z.string().describe("The Google tag config ID to delete"),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      gtagConfigId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_gtag_config for account ${accountId}, container ${containerId}, workspace ${workspaceId}, gtagConfig ${gtagConfigId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.gtag_config.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Google tag config ${gtagConfigId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting Google tag config ${gtagConfigId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
