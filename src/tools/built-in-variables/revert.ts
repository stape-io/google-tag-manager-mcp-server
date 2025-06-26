import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): void =>
  server.tool(
    "tag_manager_revert_built_in_variable",
    "Reverts changes to a GTM Built-In Variable in a GTM Workspace",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the built-in variables.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the built-in variables.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the built-in variables.",
        ),
      type: z
        .string()
        .describe(
          "The built-in variable type to revert (e.g., 'PAGE_URL', 'REFERRER', etc.).",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      type,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_built_in_variable for account ${accountId}, container ${containerId}, workspace ${workspaceId}, type ${type}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.built_in_variables.revert(
            {
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
              type,
            },
          );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting built-in variable type ${type} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
