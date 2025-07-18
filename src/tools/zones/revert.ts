import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_revert_zone",
    "Reverts changes to a GTM Zone in a GTM Workspace",
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
      zoneId: z.string().describe("The unique ID of the GTM Zone to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe("Fingerprint for optimistic concurrency control."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      zoneId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_zone for account ${accountId}, container ${containerId}, workspace ${workspaceId}, zone ${zoneId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.zones.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting zone ${zoneId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
