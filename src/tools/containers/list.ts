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
    "tag_manager_list_containers",
    "Lists all containers within the specified GTM account",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account whose containers will be listed.",
        ),
    },
    async ({ accountId }): Promise<CallToolResult> => {
      log(`Running tool: tag_manager_list_containers for account ${accountId}`);

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);
        const response = await tagmanager.accounts.containers.list({
          parent: `accounts/${accountId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing containers for account ${accountId}`,
          error,
        );
      }
    },
  );
};
