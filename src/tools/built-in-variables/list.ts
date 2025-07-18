import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_list_built_in_variables",
    "Lists all the enabled Built-In Variables of a GTM Container",
    {
      accountId: z.string().describe("The GTM Account ID."),
      containerId: z.string().describe("The GTM Container ID."),
      workspaceId: z.string().describe("The GTM Workspace ID."),
      pageToken: z
        .string()
        .optional()
        .describe(
          "A token, which can be sent as a parameter to retrieve the next page of results.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      pageToken,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_built_in_variables for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response =
          await tagmanager.accounts.containers.workspaces.built_in_variables.list(
            {
              parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              pageToken,
            },
          );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing built-in variables in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
