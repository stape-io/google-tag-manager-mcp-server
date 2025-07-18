import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { UserPermissionSchemaFields } from "../../schemas/UserPermissionSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$UserPermission = tagmanager_v2.Schema$UserPermission;

export const update = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_update_user_permission",
    "Updates a user's Account & Container access",
    UserPermissionSchemaFields,
    async ({
      accountId,
      userPermissionId,
      ...rest
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_update_user_permission for account ${accountId}, userPermission ${userPermissionId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.users",
        ]);
        const response = await tagmanager.accounts.user_permissions.update({
          path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
          requestBody: rest as Schema$UserPermission,
        });
        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error updating user permission ${userPermissionId} in account ${accountId}`,
          error,
        );
      }
    },
  );
