import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { WorkspaceSchemaFields } from "../../schemas/WorkspaceSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Workspace = tagmanager_v2.Schema$Workspace;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_container_workspace",
    "Updates a Workspace",
    WorkspaceSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_container_workspace for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.workspaces.update(
          {
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            fingerprint,
            requestBody: rest as Schema$Workspace,
          },
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
