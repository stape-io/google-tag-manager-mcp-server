import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { ZoneSchemaFields } from "../../schemas/ZoneSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Zone = tagmanager_v2.Schema$Zone;

export const create = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_create_zone",
    "Creates a GTM Zone",
    ZoneSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_zone for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.zones.create({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            requestBody: rest as Schema$Zone,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating zone in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
