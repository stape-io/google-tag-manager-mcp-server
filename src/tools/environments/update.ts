import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EnvironmentSchemaFields } from "../../schemas/EnvironmentSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_container_environment",
    "Updates a GTM Environment",
    EnvironmentSchemaFields,
    async ({
      accountId,
      containerId,
      environmentId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_container_environment for account ${accountId}, container ${containerId}, environment ${environmentId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.environments.update({
            path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
            fingerprint,
            requestBody: rest,
          });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating environment ${environmentId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
