import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TagSchemaFields } from "../../schemas/TagSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Tag = tagmanager_v2.Schema$Tag;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_tag",
    "Updates a GTM Tag",
    TagSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      tagId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_tag for account ${accountId}, container ${containerId}, workspace ${workspaceId}, tag ${tagId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.tags.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/tags/${tagId}`,
            fingerprint,
            requestBody: rest as Schema$Tag,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating tag ${tagId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
