import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_list_container_environments",
    "Lists all GTM Environments in a container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the environments.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the environments.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({ accountId, containerId, pageToken }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_container_environments for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.environments.list(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
            pageToken,
          },
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing environments in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
