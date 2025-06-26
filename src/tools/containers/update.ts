import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ContainerSchemaFields } from "../../schemas/ContainerSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_container",
    "Updates a GTM Container",
    ContainerSchemaFields,
    async ({
      accountId,
      containerId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_container for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.update({
          path: `accounts/${accountId}/containers/${containerId}`,
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
          `Error updating container at account ${accountId}, container ${containerId}`,
          error,
        );
      }
    },
  );
