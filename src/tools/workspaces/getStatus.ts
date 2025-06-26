import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const getStatus = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_workspace_status",
    "Finds conflicting and modified entities in the workspace",
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
        .describe(
          "The unique ID of the GTM Workspace for which to get status.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_workspace_status for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.getStatus({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting workspace status for workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
