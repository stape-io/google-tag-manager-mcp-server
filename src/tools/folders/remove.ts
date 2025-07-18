import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_delete_folder",
    "Deletes a GTM Folder",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the folder."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the folder."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the folder."),
      folderId: z
        .string()
        .describe("The unique ID of the GTM Folder to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      folderId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}, folder ${folderId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.folders.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Folder ${folderId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting folder ${folderId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
