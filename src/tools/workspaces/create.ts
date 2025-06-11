import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { WorkspaceSchemaFields } from "../../schemas/WorkspaceSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Workspace = tagmanager_v2.Schema$Workspace;
import { McpAgentToolParamsModel } from "../../models/McpAgentModel";

export const create = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "tag_manager_create_container_workspace",
    "Creates a Workspace",
    WorkspaceSchemaFields,
    async ({ accountId, containerId, ...rest }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_container_workspace for account ${accountId}, container ${containerId}`,
      );
      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.workspaces.create(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
            requestBody: rest as Schema$Workspace,
          },
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating workspace in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
};
