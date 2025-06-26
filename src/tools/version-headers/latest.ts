import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const latest = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_latest_container_version_header",
    "Gets the latest container version header",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the container."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container for which to get the latest version header.",
        ),
    },
    async ({ accountId, containerId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_latest_container_version_header for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.version_headers.latest({
            parent: `accounts/${accountId}/containers/${containerId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting latest container version header for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
