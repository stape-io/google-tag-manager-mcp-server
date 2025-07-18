import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_delete_transformation",
    "Deletes a GTM Transformation",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the transformation.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the transformation.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the transformation.",
        ),
      transformationId: z
        .string()
        .describe("The unique ID of the GTM Transformation to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      transformationId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_transformation for account ${accountId}, container ${containerId}, workspace ${workspaceId}, transformation ${transformationId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.transformations.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Transformation ${transformationId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting transformation ${transformationId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
