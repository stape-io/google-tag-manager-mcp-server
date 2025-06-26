import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_tag",
    "Deletes a GTM Tag",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the tag."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the tag."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the tag."),
      tagId: z.string().describe("The unique ID of the GTM Tag to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      tagId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_tag for account ${accountId}, container ${containerId}, workspace ${workspaceId}, tag ${tagId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.tags.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Tag ${tagId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting tag ${tagId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
