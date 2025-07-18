import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_list_zones",
    "Lists all GTM Zones of a GTM container workspace",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the zones."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the zones."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the zones."),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      pageToken,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_zones for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.zones.list({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            pageToken,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing zones in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
