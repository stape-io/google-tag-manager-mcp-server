import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";
import Schema$BuiltInVariable = tagmanager_v2.Schema$BuiltInVariable;

const ITEMS_PER_PAGE = 50;

export const builtInVariableActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_built_in_variable",
    `Performs all built-in variable operations: create, list, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    {
      action: z
        .enum(["create", "list", "remove", "revert"])
        .describe(
          "The built-in variable operation to perform. Must be one of: 'create', 'list', 'remove', 'revert'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the built-in variable.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the built-in variable.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the built-in variable.",
        ),
      type: z
        .string()
        .optional()
        .describe(
          "The built-in variable type. Required for 'revert' and 'remove' actions.",
        ),
      types: z
        .array(z.string())
        .optional()
        .describe(
          "Array of built-in variable types. Optional for 'list' action.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token for pagination. Optional for 'list' action."),
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
      containerId,
      workspaceId,
      types,
      type,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_built_in_variable with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "create": {
            if (!types) {
              throw new Error(`types is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.built_in_variables.create(
                {
                  parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                  type: types,
                },
              );

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            let all: Schema$BuiltInVariable[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.workspaces.built_in_variables.list(
                  {
                    parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                    pageToken: currentPageToken,
                  },
                );

              if (response.data.builtInVariable) {
                all = all.concat(response.data.builtInVariable);
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
          case "remove": {
            if (!types) {
              throw new Error(`types is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.built_in_variables.delete(
              {
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
                type: types,
              },
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Built-in variables deleted in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "revert": {
            if (!type) {
              throw new Error(`type is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.built_in_variables.revert(
                {
                  path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/built_in_variables`,
                  type,
                },
              );

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (error) {
        return createErrorResponse(
          `Error performing ${action} on built-in variable`,
          error,
        );
      }
    },
  );
};
