import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import { McpAgentToolParamsModel } from "../../models/McpAgentModel";

export const list = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "tag_manager_list_container_destinations",
    "Lists all destinations in a container",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destinations.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container for which to list destinations.",
        ),
    },
    async ({ accountId, containerId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_container_destinations for account ${accountId}, container ${containerId}`,
      );

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.destinations.list(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
          },
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing destinations in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
};
