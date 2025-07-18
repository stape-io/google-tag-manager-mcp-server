import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_list_transformations",
    "Lists all GTM Transformations of a GTM container workspace",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the transformations.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the transformations.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the transformations.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      pageToken,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_transformations for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.transformations.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            pageToken,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing transformations in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
