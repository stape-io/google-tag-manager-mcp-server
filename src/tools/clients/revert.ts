import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const revert = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_revert_client",
    "Reverts changes to a GTM Client in a GTM Workspace",
    {
      accountId: z.string().describe("The GTM Account ID."),
      containerId: z.string().describe("The GTM Container ID."),
      workspaceId: z.string().describe("The GTM Workspace ID."),
      clientId: z.string().describe("The GTM Client ID to revert."),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. If provided, must match the latest fingerprint of the client.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      clientId,
      fingerprint,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_revert_client for account ${accountId}, container ${containerId}, workspace ${workspaceId}, client ${clientId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.clients.revert({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
            fingerprint,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error reverting client ${clientId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
