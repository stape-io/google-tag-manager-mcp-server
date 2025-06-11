import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import { McpAgentToolParamsModel } from "../../models/McpAgentModel";

export const combine = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "tag_manager_combine_containers",
    "Combines two GTM Containers",
    {
      accountId: z.string().describe("The GTM account ID"),
      fromContainerId: z
        .string()
        .describe("ID of container that data from will be merged"),
      toContainerId: z
        .string()
        .describe("ID of target container to merge data"),
      allowUserPermissionFeatureUpdate: z
        .boolean()
        .optional()
        .describe(
          "Must be set to true to allow features.user_permissions to change from false to true.",
        ),
      settingSource: z
        .string()
        .optional()
        .describe("Specify the source of config setting after combine"),
    },
    async ({
      accountId,
      fromContainerId,
      toContainerId,
      allowUserPermissionFeatureUpdate,
      settingSource,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_combine_containers for accountId ${accountId}, containerId ${fromContainerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.combine({
          path: `accounts/${accountId}/containers/${fromContainerId}`,
          containerId: toContainerId,
          allowUserPermissionFeatureUpdate,
          settingSource,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error combining containers for accountId ${accountId}, containerId ${fromContainerId}}`,
          error,
        );
      }
    },
  );
};
