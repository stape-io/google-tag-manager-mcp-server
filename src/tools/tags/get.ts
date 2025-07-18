import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_tag",
    "Gets a GTM Tag",
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
      tagId: z.string().describe("The unique ID of the GTM Tag to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      tagId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_tag for account ${accountId}, container ${containerId}, workspace ${workspaceId}, tag ${tagId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.tags.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting tag ${tagId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
