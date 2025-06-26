import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): void =>
  server.tool(
    "tag_manager_get_zone",
    "Gets a GTM Zone",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the zone."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the zone."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the zone."),
      zoneId: z.string().describe("The unique ID of the GTM Zone to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      zoneId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_zone for account ${accountId}, container ${containerId}, workspace ${workspaceId}, zone ${zoneId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.zones.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting zone ${zoneId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
