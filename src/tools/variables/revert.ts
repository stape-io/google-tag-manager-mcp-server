import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): void =>
  server.tool(
    "tag_manager_revert_variable",
    "Reverts changes to a GTM Variable in a GTM Workspace",
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
        .describe("The unique ID of the GTM Variable to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. If provided, must match the latest fingerprint of the variable.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      variableId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_variable for account ${accountId}, container ${containerId}, workspace ${workspaceId}, variable ${variableId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.variables.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting variable ${variableId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
