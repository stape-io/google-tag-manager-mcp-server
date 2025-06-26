import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const create = (server: McpServer): void =>
  server.tool(
    "tag_manager_create_built_in_variables",
    "Creates one or more GTM Built-In Variables",
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
          "The unique ID of the GTM Workspace where the built-in variables will be enabled.",
        ),
      types: z
        .array(z.string())
        .describe(
          "An array of built-in variable types to enable (e.g., 'PAGE_URL', 'REFERRER', etc.).",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      types,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_built_in_variables for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.built_in_variables.create(
            {
              parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              type: types,
            },
          );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating built-in variables in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
