import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const live = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_live_container_version",
    "Gets the live Container Version",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the live container version.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container for which to get the live version.",
        ),
    },
    async ({ accountId, containerId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_live_container_version for account ${accountId}, container ${containerId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.versions.live({
          parent: `accounts/${accountId}/containers/${containerId}`,
        });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting live container version for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
