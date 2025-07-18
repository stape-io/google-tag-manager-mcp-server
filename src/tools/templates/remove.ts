import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_delete_template",
    "Deletes a GTM Custom Template",
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
        .describe("The unique ID of the GTM Custom Template to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      templateId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_template for account ${accountId}, container ${containerId}, workspace ${workspaceId}, template ${templateId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.templates.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Template ${templateId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting template ${templateId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
