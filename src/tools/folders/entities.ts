import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const entities = (server: McpServer): void =>
  server.tool(
    "tag_manager_entities_in_folder",
    "Lists all entities in a GTM Folder",
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
        .describe(
          "The unique ID of the GTM Folder whose entities will be listed.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      folderId,
      pageToken,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_entities_in_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}, folder ${folderId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.folders.entities({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
            pageToken,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing entities in folder ${folderId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
