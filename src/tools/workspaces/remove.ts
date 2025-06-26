import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_container_workspace",
    "Deletes a Workspace",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the workspace."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the workspace.",
        ),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_container_workspace for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.delete.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Workspace ${workspaceId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting workspace ${workspaceId} from container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
