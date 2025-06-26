import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_client",
    "Deletes a GTM Client",
    {
      accountId: z
        .string()
        .describe("The ID of the GTM Account that owns the client."),
      containerId: z
        .string()
        .describe("The ID of the GTM Container that owns the client."),
      workspaceId: z
        .string()
        .describe("The ID of the GTM Workspace that owns the client."),
      clientId: z.string().describe("The ID of the GTM Client to delete."),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      clientId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_client for account ${accountId}, container ${containerId}, workspace ${workspaceId}, client ${clientId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.clients.delete({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `Client ${clientId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting client ${clientId} from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
