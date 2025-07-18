import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_container",
    "Gets a specific container from an account",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the container."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container to retrieve."),
    },
    async ({ accountId, containerId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_container for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.get({
          path: `accounts/${accountId}/containers/${containerId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
