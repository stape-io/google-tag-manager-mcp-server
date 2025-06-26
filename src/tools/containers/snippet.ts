import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const snippet = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_container_snippet",
    "Gets the tagging snippet for a container",
    {
      accountId: z.string().describe("The GTM account ID"),
      containerId: z.string().describe("The container ID"),
    },
    async ({ accountId, containerId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_container_snippet for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.snippet({
          path: `accounts/${accountId}/containers/${containerId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting container snippet for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
