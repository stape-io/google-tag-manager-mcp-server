import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): void =>
  server.tool(
    "tag_manager_list_gtag_configs",
    "Lists all Google tag configs in a Container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the Google tag configs.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the Google tag configs.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the Google tag configs.",
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
        `Running tool: tag_manager_list_gtag_configs for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.gtag_config.list({
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
          `Error listing Google tag configs in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
