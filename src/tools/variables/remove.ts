import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_variable",
    "Deletes a GTM Variable",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the variable."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the variable.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the variable.",
        ),
      variableId: z
        .string()
        .describe("The unique ID of the GTM Variable to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      variableId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_variable for account ${accountId}, container ${containerId}, workspace ${workspaceId}, variable ${variableId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.variables.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Variable ${variableId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting variable ${variableId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
