import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_revert_trigger",
    "Reverts changes to a GTM Trigger in a GTM Workspace",
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
        .describe("The unique ID of the GTM Trigger to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. If provided, must match the latest fingerprint of the trigger.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      triggerId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_trigger for account ${accountId}, container ${containerId}, workspace ${workspaceId}, trigger ${triggerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.triggers.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting trigger ${triggerId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
