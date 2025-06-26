import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { CustomTemplateSchemaFields } from "../../schemas/CustomTemplateSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$CustomTemplate = tagmanager_v2.Schema$CustomTemplate;

export const update = (server: McpServer): void =>
  server.tool(
    "tag_manager_update_template",
    "Updates a GTM Custom Template",
    CustomTemplateSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      templateId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_template for account ${accountId}, container ${containerId}, workspace ${workspaceId}, template ${templateId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.templates.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
            fingerprint,
            requestBody: rest as Schema$CustomTemplate,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating template ${templateId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
