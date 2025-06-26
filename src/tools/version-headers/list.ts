import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): void =>
  server.tool(
    "tag_manager_list_container_version_headers",
    "Lists all container version headers of a GTM Container",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the container."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container for which to list version headers.",
        ),
      includeDeleted: z
        .boolean()
        .describe("Whether to also retrieve deleted (archived) versions."),
      pageToken: z
        .string()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({
      accountId,
      containerId,
      includeDeleted,
      pageToken,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_container_version_headers for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.version_headers.list({
            parent: `accounts/${accountId}/containers/${containerId}`,
            includeDeleted,
            pageToken,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing container version headers for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
