import { McpServer } from "@modelcontextprotocol/server";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { VariableSchema } from "../schemas/VariableSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  getServerGtmRuntime,
  log,
} from "../utils/index.js";
import Schema$Variable = tagmanager_v2.Schema$Variable;

const PayloadSchema = VariableSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  variableId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 20;

export const variableActions = (
  server: McpServer,
  { auth, runtime = getServerGtmRuntime(server) }: GtmToolContext,
): void => {
  server.registerTool(
    "gtm_variable",
    {
      description: `Performs all GTM variable operations: create, get, list, update, remove, revert. The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
      inputSchema: z.object({
        action: z
          .enum(["create", "get", "list", "update", "remove", "revert"])
          .describe(
            "The GTM variable operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
          ),
        accountId: z
          .string()
          .describe(
            "The unique ID of the GTM Account containing the variable.",
          ),
        containerId: z
          .string()
          .describe(
            "The unique ID of the GTM Container containing the variable.",
          ),
        workspaceId: z
          .string()
          .describe(
            "The unique ID of the GTM Workspace containing the variable.",
          ),
        variableId: z
          .string()
          .optional()
          .describe(
            "The unique ID of the GTM variable. Required for 'get', 'update', 'remove', and 'revert' actions.",
          ),
        createOrUpdateConfig: PayloadSchema.optional().describe(
          "Configuration for 'create' and 'update' actions. All fields correspond to the GTM variable resource, except IDs. 'update' replaces the entire variable — any field omitted here is deleted. Always run 'get' first and send back the complete object with your modifications applied.",
        ),
        fingerprint: z
          .string()
          .optional()
          .describe(
            "The fingerprint for optimistic concurrency control. Required for 'update' and 'revert' actions.",
          ),
        fresh: z
          .boolean()
          .default(false)
          .describe("Bypass the cached list snapshot. Applies only to list."),
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
      }),
    },
    async ({
      action,
      accountId,
      containerId,
      workspaceId,
      variableId,
      createOrUpdateConfig,
      fingerprint,
      page,
      itemsPerPage,
      fresh,
    }) => {
      log(`Running tool: gtm_variable with action ${action}`);

      const invocation = runtime.startCall(auth, "gtm_variable", action);
      try {
        if (action === "list") {
          const result = await invocation.listPage(
            `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables`,
            fresh,
            page,
            itemsPerPage,
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }
        const tagmanager = await getTagManagerClient(auth, invocation);

        switch (action) {
          case "create": {
            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.workspaces.variables.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: createOrUpdateConfig as Schema$Variable,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!variableId) {
              throw new Error(`variableId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.variables.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "update": {
            if (!variableId) {
              throw new Error(`variableId is required for ${action} action`);
            }

            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            if (!fingerprint) {
              throw new Error(`fingerprint is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.variables.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$Variable,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!variableId) {
              throw new Error(`variableId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.variables.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Variable ${variableId} was successfully deleted`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "revert": {
            if (!variableId) {
              throw new Error(`variableId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.variables.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/variables/${variableId}`,
                fingerprint,
              });

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
          `Error performing ${action} on GTM variable`,
          error,
        );
      }
    },
  );
};
