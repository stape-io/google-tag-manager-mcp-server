import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_container_environment",
    "Gets a GTM Environment",
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
        .describe("The unique ID of the GTM Environment to retrieve."),
    },
    async ({
      accountId,
      containerId,
      environmentId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_container_environment for account ${accountId}, container ${containerId}, environment ${environmentId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.containers.environments.get({
          path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting environment ${environmentId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
