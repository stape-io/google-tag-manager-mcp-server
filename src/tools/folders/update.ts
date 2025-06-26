import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { FolderSchemaFields } from "../../schemas/FolderSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Folder = tagmanager_v2.Schema$Folder;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_folder",
    "Updates a GTM Folder",
    FolderSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      folderId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}, folder ${folderId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.folders.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
            fingerprint,
            requestBody: rest as Schema$Folder,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating folder ${folderId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
