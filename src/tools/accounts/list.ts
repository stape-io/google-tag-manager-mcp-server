import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import { z } from "zod";

const ListAccountsSchema = z.object({});

export const list = (server: McpServer): void =>
  server.tool(
    "tag_manager_list_accounts",
    "Lists all GTM accounts accessible by the authenticated user",
    {},
    async (args): Promise<CallToolResult> => {
      log("Running tool: tag_manager_list_accounts");

      try {
        ListAccountsSchema.parse(args);

        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
          "https://www.googleapis.com/auth/tagmanager.manage.accounts",
          "https://www.googleapis.com/auth/tagmanager.readonly",
        ]);
        const response = await tagmanager.accounts.list({});

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse("Error listing accounts", error);
      }
    },
  );
