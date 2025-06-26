import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { UserPermissionSchemaFields } from "../../schemas/UserPermissionSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$UserPermission = tagmanager_v2.Schema$UserPermission;

export const create = (server: McpServer): void =>
  server.tool(
    "tag_manager_create_user_permission",
    "Creates a user's Account & Container access",
    UserPermissionSchemaFields,
    async ({ accountId, ...rest }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_user_permission for account ${accountId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.manage.users",
        ]);
        const response = await tagmanager.accounts.user_permissions.create({
          parent: `accounts/${accountId}`,
          requestBody: rest as Schema$UserPermission,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating user permission for account ${accountId}`,
          error,
        );
      }
    },
  );
