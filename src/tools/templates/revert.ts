import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_revert_template",
    "Reverts changes to a GTM Custom Template in a GTM Workspace",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the custom template.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the custom template.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the custom template.",
        ),
      templateId: z
        .string()
        .describe("The unique ID of the GTM Custom Template to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe("Fingerprint for optimistic concurrency control."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      templateId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_template for account ${accountId}, container ${containerId}, workspace ${workspaceId}, template ${templateId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.templates.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting template ${templateId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
