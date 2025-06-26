import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const unlink = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_container_destination",
    "Deletes a destination from a container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destination.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container from which to unlink the destination.",
        ),
      destinationId: z
        .string()
        .describe("The unique ID of the GTM Destination to delete."),
    },
    async ({
      accountId,
      containerId,
      destinationId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_container_destination for account ${accountId}, container ${containerId}, destination ${destinationId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "ttps://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.destinations.link({
          parent: `accounts/${accountId}/containers/${containerId}`,
          destinationId: destinationId,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Destination ${destinationId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting destination ${destinationId} from container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
