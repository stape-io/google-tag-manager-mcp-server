import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { EnvironmentSchemaFields } from "../../schemas/EnvironmentSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const create = (server: McpServer): void =>
  server.tool(
    "tag_manager_create_container_environment",
    "Creates a GTM Environment",
    EnvironmentSchemaFields,
    async ({ accountId, containerId, ...rest }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_container_environment for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.environments.create({
            parent: `accounts/${accountId}/containers/${containerId}`,
            requestBody: rest,
          });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating environment in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
