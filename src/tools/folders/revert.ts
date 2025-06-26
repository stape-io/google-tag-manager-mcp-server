import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): void =>
  server.tool(
    "tag_manager_revert_folder",
    "Reverts changes to a GTM Folder in a GTM Workspace",
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
        .describe("The unique ID of the GTM Folder to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. If provided, must match the latest fingerprint of the folder.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      folderId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}, folder ${folderId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.folders.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/folders/${folderId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting folder ${folderId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
