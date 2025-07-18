import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { WorkspaceSchemaFields } from "../../schemas/WorkspaceSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Workspace = tagmanager_v2.Schema$Workspace;

export const create = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_create_container_workspace",
    "Creates a Workspace",
    WorkspaceSchemaFields,
    async ({ accountId, containerId, ...rest }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_container_workspace for account ${accountId}, container ${containerId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.workspaces.create(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
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
          `Error creating workspace in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
