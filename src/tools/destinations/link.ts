import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const link = (server: McpServer): void =>
  server.tool(
    "tag_manager_link_container_destination",
    "Links a destination to a container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destination.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container to which to link the destination.",
        ),
      destinationId: z
        .string()
        .describe(
          "The unique ID of the GTM Destination to link (e.g. AW-123456789).",
        ),
      allowUserPermissionFeatureUpdate: z
        .boolean()
        .describe(
          "If true, allows user permission feature update during linking.",
        ),
    },
    async ({
      accountId,
      containerId,
      destinationId,
      allowUserPermissionFeatureUpdate,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_link_container_destination for account ${accountId}, container ${containerId}, destination ${destinationId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "ttps://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.destinations.link(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
            destinationId,
            allowUserPermissionFeatureUpdate,
          },
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error linking destination ${destinationId} to container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
