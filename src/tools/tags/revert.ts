import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_revert_tag",
    "Reverts changes to a GTM Tag in a GTM Workspace",
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
      tagId: z.string().describe("The unique ID of the GTM Tag to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. If provided, must match the latest fingerprint of the tag.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      tagId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_tag for account ${accountId}, container ${containerId}, workspace ${workspaceId}, tag ${tagId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.tags.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting tag ${tagId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
