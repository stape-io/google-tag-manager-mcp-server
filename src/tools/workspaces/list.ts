import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): void =>
  server.tool(
    "tag_manager_list_container_workspaces",
    "Lists all Workspaces that belong to a GTM Container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the workspaces.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the workspaces.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({ accountId, containerId, pageToken }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_container_workspaces for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.workspaces.list({
          parent: `accounts/${accountId}/containers/${containerId}`,
          pageToken,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing workspaces in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
