import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_container_environment",
    "Deletes a GTM Environment",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the environment.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the environment.",
        ),
      environmentId: z
        .string()
        .describe("The unique ID of the GTM Environment to delete."),
    },
    async ({
      accountId,
      containerId,
      environmentId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_container_environment for account ${accountId}, container ${containerId}, environment ${environmentId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.environments.delete({
          path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Environment ${environmentId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting environment ${environmentId} from container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
