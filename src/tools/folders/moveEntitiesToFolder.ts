import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { FolderSchemaFields } from "../../schemas/FolderSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const moveEntitiesToFolder = (server: McpServer): void =>
  server.tool(
    "tag_manager_move_entities_to_folder",
    "Moves entities to a GTM Folder",
    {
      tagId: z
        .array(z.string())
        .describe("The tags to be moved to the folder."),
      triggerId: z
        .array(z.string())
        .describe("The triggers to be moved to the folder."),
      variableId: z
        .array(z.string())
        .describe("The variables to be moved to the folder."),
      ...FolderSchemaFields,
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      folderId,
      tagId,
      triggerId,
      variableId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_move_entities_to_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}, folder ${folderId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.folders.move_entities_to_folder(
          {
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
            tagId,
            triggerId,
            variableId,
            requestBody: rest,
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Entities moved to folder ${folderId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error moving entities to folder ${folderId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
