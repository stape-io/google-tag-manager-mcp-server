import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { FolderSchemaFields } from "../../schemas/FolderSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Folder = tagmanager_v2.Schema$Folder;
import { McpAgentToolParamsModel } from "../../models/McpAgentModel";

export const create = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "tag_manager_create_folder",
    "Creates a GTM Folder",
    FolderSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_folder for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response =
          await tagmanager.accounts.containers.workspaces.folders.create({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            requestBody: rest as Schema$Folder,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating folder in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
};
