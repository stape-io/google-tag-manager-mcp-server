import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const sync = (server: McpServer): void =>
  server.tool(
    "tag_manager_sync_container_workspace",
    "Syncs a workspace to the latest container version",
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
        .describe("The unique ID of the GTM Workspace to sync."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_sync_container_workspace for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.workspaces.sync({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error syncing workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
