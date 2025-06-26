import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_trigger",
    "Deletes a GTM Trigger",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the trigger."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the trigger."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the trigger."),
      triggerId: z
        .string()
        .describe("The unique ID of the GTM Trigger to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      triggerId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_trigger for account ${accountId}, container ${containerId}, workspace ${workspaceId}, trigger ${triggerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.triggers.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Trigger ${triggerId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting trigger ${triggerId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
