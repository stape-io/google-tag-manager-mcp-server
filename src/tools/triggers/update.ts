import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TriggerSchemaFields } from "../../schemas/TriggerSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Trigger = tagmanager_v2.Schema$Trigger;

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_trigger",
    "Updates a GTM Trigger",
    TriggerSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      triggerId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_trigger for account ${accountId}, container ${containerId}, workspace ${workspaceId}, trigger ${triggerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.triggers.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/triggers/${triggerId}`,
            fingerprint,
            requestBody: rest as Schema$Trigger,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating trigger ${triggerId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
