import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const get = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_get_user_permission",
    "Gets a user's Account & Container access",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the user permission.",
        ),
      userPermissionId: z
        .string()
        .describe("The unique ID of the user permission to retrieve."),
    },
    async ({ accountId, userPermissionId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_get_user_permission for account ${accountId}, userPermission ${userPermissionId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.users",
        ]);
        const response = await tagmanager.accounts.user_permissions.get({
          path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error getting user permission ${userPermissionId} in account ${accountId}`,
          error,
        );
      }
    },
  );
