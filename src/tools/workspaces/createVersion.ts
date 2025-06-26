import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WorkspaceSchemaFields } from "../../schemas/WorkspaceSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const createVersion = (server: McpServer): void =>
  server.tool(
    "tag_manager_create_container_version_from_workspace",
    "Creates a Container Version from the entities present in the workspace",
    WorkspaceSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_container_version_from_workspace for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.create_version({
            path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            requestBody: rest,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating container version from workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
