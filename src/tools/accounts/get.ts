import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

const GetAccountSchema = z.object({
  accountId: z
    .string()
    .describe("The unique ID of the GTM Account to retrieve."),
});

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_account",
    "Gets a GTM Account",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account to retrieve."),
    },
    async (args): Promise<CallToolResult> => {
      const { accountId } = GetAccountSchema.parse(args);
      log(`Running tool: tag_manager_get_account for account ${accountId}`);

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.manage.accounts",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.get({
          path: `accounts/${accountId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting account at account ${accountId}`,
          error,
        );
      }
    },
  );
