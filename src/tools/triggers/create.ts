import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { TriggerSchemaFields } from "../../schemas/TriggerSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Trigger = tagmanager_v2.Schema$Trigger;
import { McpAgentToolParamsModel } from "../../models/McpAgentModel";

export const create = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "tag_manager_create_trigger",
    "Creates a GTM Trigger",
    TriggerSchemaFields,
    async ({
      accountId,
      containerId,
      workspaceId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_trigger for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response =
          await tagmanager.accounts.containers.workspaces.triggers.create({
            parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            requestBody: rest as Schema$Trigger,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating trigger in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
};
