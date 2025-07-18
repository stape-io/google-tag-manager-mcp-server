import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_gtag_config",
    "Gets a Google tag config",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the Google tag config.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the Google tag config.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the Google tag config.",
        ),
      gtagConfigId: z
        .string()
        .describe("The unique ID of the Google tag config to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      gtagConfigId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_gtag_config for account ${accountId}, container ${containerId}, workspace ${workspaceId}, gtagConfig ${gtagConfigId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.gtag_config.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting Google tag config ${gtagConfigId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
