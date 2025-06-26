import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_built_in_variables",
    "Deletes one or more GTM Built-In Variables",
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
      types: z
        .array(z.string())
        .describe(
          "An array of built-in variable types to delete (e.g., 'PAGE_URL', 'REFERRER', etc.).",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      types,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_built_in_variables for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.built_in_variables.delete(
          {
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
            type: types,
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Built-in variables deleted in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting built-in variables in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
