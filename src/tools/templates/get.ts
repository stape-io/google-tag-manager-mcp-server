import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_template",
    "Gets a GTM Custom Template",
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
        .describe("The unique ID of the GTM Custom Template to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      templateId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_template for account ${accountId}, container ${containerId}, workspace ${workspaceId}, template ${templateId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.templates.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting template ${templateId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
