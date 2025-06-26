import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_transformation",
    "Gets a GTM Transformation",
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
        .describe("The unique ID of the GTM Transformation to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      transformationId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_transformation for account ${accountId}, container ${containerId}, workspace ${workspaceId}, transformation ${transformationId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.transformations.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting transformation ${transformationId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
