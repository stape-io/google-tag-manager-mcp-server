import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const publish = (server: McpServer): void =>
  server.tool(
    "tag_manager_publish_container_version",
    "Publishes a Container Version",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the container version.",
        ),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the version."),
      containerVersionId: z
        .string()
        .describe("The unique ID of the GTM Container Version to publish."),
      fingerprint: z
        .string()
        .optional()
        .describe("The fingerprint for optimistic concurrency control."),
    },
    async ({
      accountId,
      containerId,
      containerVersionId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_publish_container_version for account ${accountId}, container ${containerId}, version ${containerVersionId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.publish",
        ]);
        const response = await tagmanager.accounts.containers.versions.publish({
          path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
          fingerprint,
        });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error publishing container version ${containerVersionId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
