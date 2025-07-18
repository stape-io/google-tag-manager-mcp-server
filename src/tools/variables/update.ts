import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { VariableSchemaFields } from "../../schemas/VariableSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Variable = tagmanager_v2.Schema$Variable;

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_variable",
    "Updates a GTM Variable",
    VariableSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      variableId,
      fingerprint,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_variable for account ${accountId}, container ${containerId}, workspace ${workspaceId}, variable ${variableId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.variables.update({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
            fingerprint,
            requestBody: rest as Schema$Variable,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating variable ${variableId} in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
