import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TransformationSchemaFields } from "../../schemas/TransformationSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Transformation = tagmanager_v2.Schema$Transformation;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_transformation",
    "Updates a GTM Transformation",
    TransformationSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      transformationId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_transformation for account ${accountId}, container ${containerId}, workspace ${workspaceId}, transformation ${transformationId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.transformations.update(
            {
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/transformations/${transformationId}`,
              fingerprint,
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
          `Error updating transformation ${transformationId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
