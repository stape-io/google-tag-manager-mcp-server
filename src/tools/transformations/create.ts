import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TransformationSchemaFields } from "../../schemas/TransformationSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Transformation = tagmanager_v2.Schema$Transformation;

export const create = (server: McpServer): void =>
  server.tool(
    "tag_manager_create_transformation",
    "Creates a GTM Transformation",
    TransformationSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_transformation for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.transformations.create(
            {
              parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              requestBody: rest as Schema$Transformation,
            },
          );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating transformation in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
