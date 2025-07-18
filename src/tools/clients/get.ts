import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_client",
    "Gets a GTM Client",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the client."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the client."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the client."),
      clientId: z
        .string()
        .describe("The unique ID of the GTM Client to retrieve."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      clientId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_client for account ${accountId}, container ${containerId}, workspace ${workspaceId}, client ${clientId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.clients.get({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting client ${clientId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
