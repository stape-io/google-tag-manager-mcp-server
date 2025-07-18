import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { ContainerVersionSchemaFields } from "../../schemas/ContainerVersionSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$ContainerVersion = tagmanager_v2.Schema$ContainerVersion;

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_container_version",
    "Updates a Container Version.",
    ContainerVersionSchemaFields,
    async ({
      accountId,
      containerId,
      containerVersionId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_container_version for account ${accountId}, container ${containerId}, version ${containerVersionId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        ]);
        const response = await tagmanager.accounts.containers.versions.update({
          path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
          fingerprint,
          requestBody: rest as Schema$ContainerVersion,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating container version ${containerVersionId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
