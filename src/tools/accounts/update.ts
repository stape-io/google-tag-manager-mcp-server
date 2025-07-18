import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AccountSchemaFields } from "../../schemas/AccountSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_account",
    "Updates a GTM Account",
    AccountSchemaFields,
    async ({ accountId, fingerprint, ...rest }): Promise<CallToolResult> => {
      log(`Running tool: tag_manager_update_account for account ${accountId}`);

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.accounts",
        ]);
        const response = await tagmanager.accounts.update({
          path: `accounts/${accountId}`,
          fingerprint,
          requestBody: rest,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating account at account ${accountId}`,
          error,
        );
      }
    },
  );
