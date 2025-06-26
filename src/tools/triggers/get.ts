import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_trigger",
    "Gets a GTM Trigger",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the trigger."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the trigger."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the trigger."),
      triggerId: z
        .string()
        .describe("The unique ID of the GTM Trigger to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      triggerId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_trigger for account ${accountId}, container ${containerId}, workspace ${workspaceId}, trigger ${triggerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.triggers.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting trigger ${triggerId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
