import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const reauthorize = (server: McpServer): void =>
  server.tool(
    "tag_manager_reauthorize_container_environment",
    "Re-generates the authorization code for a GTM Environment",
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
        .describe("The unique ID of the GTM Environment to reauthorize."),
    },
    async ({
      accountId,
      containerId,
      environmentId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_reauthorize_container_environment for account ${accountId}, container ${containerId}, environment ${environmentId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.publish",
        ]);
        const response =
          await tagmanager.accounts.containers.environments.reauthorize({
            path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
          });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reauthorizing environment ${environmentId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
