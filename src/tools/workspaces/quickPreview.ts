import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const quickPreview = (server: McpServer): void =>
  server.tool(
    "tag_manager_quick_preview_container_workspace",
    "Quick previews a workspace by creating a fake container version",
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
        .describe("The unique ID of the GTM Workspace to quick preview."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_quick_preview_container_workspace for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.quick_preview({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error quick previewing workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
