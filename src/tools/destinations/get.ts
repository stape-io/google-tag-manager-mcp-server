import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_container_destination",
    "Gets a specific destination from a container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destination.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the destination.",
        ),
      destinationId: z
        .string()
        .describe("The unique ID of the GTM Destination to retrieve."),
    },
    async ({
      accountId,
      containerId,
      destinationId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_container_destination for account ${accountId}, container ${containerId}, destination ${destinationId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.destinations.get({
          path: `accounts/${accountId}/containers/${containerId}/destinations/${destinationId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting destination ${destinationId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
