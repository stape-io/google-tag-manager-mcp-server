import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { UserPermissionSchema } from "../schemas/UserPermissionSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";
import Schema$Account = tagmanager_v2.Schema$Account;
import Schema$UserPermission = tagmanager_v2.Schema$UserPermission;

const ITEMS_PER_PAGE = 50;

export const userPermissionActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_user_permission",
    `Performs all user permission operations: create, get, list, update, remove. The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum(["create", "get", "list", "update", "remove"])
        .describe(
          "The user permission operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the user permission.",
        ),
      userPermissionId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the user permission. Required for 'get', 'update', and 'remove' actions.",
        ),
      createOrUpdateConfig: UserPermissionSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM user permission resource.",
      ),
      page: z
        .number()
        .min(1)
        .default(1)
        .describe(
          `Page number for pagination (starts from 1). Each page contains up to itemsPerPage items.`,
        ),
      itemsPerPage: z
        .number()
        .min(1)
        .max(ITEMS_PER_PAGE)
        .default(ITEMS_PER_PAGE)
        .describe(
          `Number of items to return per page (1-${ITEMS_PER_PAGE}). Default: ${ITEMS_PER_PAGE}. Use lower values if experiencing response issues.`,
        ),
    },
    async ({
      action,
      accountId,
      userPermissionId,
      createOrUpdateConfig,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_user_permission with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "create": {
            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response = await tagmanager.accounts.user_permissions.create({
              parent: `accounts/${accountId}`,
              requestBody: createOrUpdateConfig as Schema$UserPermission,
            });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!userPermissionId) {
              throw new Error(
                `userPermissionId is required for ${action} action`,
              );
            }

            const response = await tagmanager.accounts.user_permissions.get({
              path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
            });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            let all: Schema$Account[] = [];
            let currentPageToken = "";

            do {
              const response = await tagmanager.accounts.user_permissions.list({
                parent: `accounts/${accountId}`,
                pageToken: currentPageToken,
              });

              if (response.data.userPermission) {
                all = all.concat(response.data.userPermission);
              }

              currentPageToken = response.data.nextPageToken || "";
            } while (currentPageToken);

            const paginatedResult = paginateArray(all, page, itemsPerPage);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(paginatedResult, null, 2),
                },
              ],
            };
          }
          case "update": {
            if (!userPermissionId) {
              throw new Error(
                `userPermissionId is required for ${action} action`,
              );
            }

            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response = await tagmanager.accounts.user_permissions.update({
              path: `accounts/${accountId}/user_permissions/${userPermissionId}`,
              requestBody: createOrUpdateConfig as Schema$UserPermission,
            });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!userPermissionId) {
              throw new Error(
                `userPermissionId is required for ${action} action`,
              );
            }

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
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return createErrorResponse(
          `Error performing ${action} on user permission`,
          error,
        );
      }
    },
  );
};
