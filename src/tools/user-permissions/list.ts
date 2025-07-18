import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const list = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_list_user_permissions",
    "Lists all users that have access to the account along with Account and Container user access granted to each of them",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account for which to list user permissions.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token used to retrieve the next page of results."),
    },
    async ({ accountId, pageToken }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_list_user_permissions for account ${accountId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.users",
        ]);
        const response = await tagmanager.accounts.user_permissions.list({
          parent: `accounts/${accountId}`,
          pageToken,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error listing user permissions for account ${accountId}`,
          error,
        );
      }
    },
  );
