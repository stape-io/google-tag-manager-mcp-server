import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_delete_zone",
    "Deletes a GTM Zone",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the zone."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the zone."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the zone."),
      zoneId: z.string().describe("The unique ID of the GTM Zone to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      zoneId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_zone for account ${accountId}, container ${containerId}, workspace ${workspaceId}, zone ${zoneId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.zones.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Zone ${zoneId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting zone ${zoneId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
