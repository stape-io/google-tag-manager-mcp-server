import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_user_permission",
    "Removes a user from the account, revoking access to it and all of its containers",
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account from which to remove the user permission.",
        ),
      userPermissionId: z
        .string()
        .describe("The unique ID of the user permission to delete."),
    },
    async ({ accountId, userPermissionId }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_user_permission for account ${accountId}, userPermission ${userPermissionId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.users",
        ]);
        await tagmanager.accounts.user_permissions.delete({
          path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `User permission ${userPermissionId} was successfully deleted`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error deleting user permission ${userPermissionId} from account ${accountId}`,
          error,
        );
      }
    },
  );
