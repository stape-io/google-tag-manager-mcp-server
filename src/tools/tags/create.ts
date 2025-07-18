import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TagSchemaFields } from "../../schemas/TagSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Tag = tagmanager_v2.Schema$Tag;

export const create = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_create_tag",
    "Creates a GTM Tag",
    TagSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_tag for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.tags.create({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            requestBody: rest as Schema$Tag,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating tag in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
