import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_variable",
    "Gets a GTM Variable",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the variable."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the variable.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the variable.",
        ),
      variableId: z
        .string()
        .describe("The unique ID of the GTM Variable to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      variableId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_variable for account ${accountId}, container ${containerId}, workspace ${workspaceId}, variable ${variableId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.variables.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting variable ${variableId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
