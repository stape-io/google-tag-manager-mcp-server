import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { EnvironmentSchema } from "../schemas/EnvironmentSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";
import Schema$Environment = tagmanager_v2.Schema$Environment;

const PayloadSchema = EnvironmentSchema.omit({
  accountId: true,
  containerId: true,
  environmentId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 50;

export const environmentActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_environment",
    `Performs all environment operations: create, get, list, update, remove, reauthorize.  The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum(["create", "get", "list", "update", "remove", "reauthorize"])
        .describe(
          "The environment operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'reauthorize'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the environment.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the environment.",
        ),
      environmentId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM Environment. Required for 'get', 'update', 'remove', and 'reauthorize' actions.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM Environment resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. Required for 'update' action.",
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
      containerId,
      environmentId,
      createOrUpdateConfig,
      fingerprint,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_environment with action ${action}`);
      try {
        const tagmanager = await getTagManagerClient(auth);
        switch (action) {
          case "create": {
            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }
            const response =
              await tagmanager.accounts.containers.environments.create({
                parent: `accounts/${accountId}/containers/${containerId}`,
                requestBody: createOrUpdateConfig,
              });
            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!environmentId) {
              throw new Error(`environmentId is required for ${action} action`);
            }
            const response =
              await tagmanager.accounts.containers.environments.get({
                path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
              });
            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            let all: Schema$Environment[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.environments.list({
                  parent: `accounts/${accountId}/containers/${containerId}`,
                  pageToken: currentPageToken,
                });

              if (response.data.environment) {
                all = all.concat(response.data.environment);
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
            if (!environmentId) {
              throw new Error(`environmentId is required for ${action} action`);
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
              await tagmanager.accounts.containers.environments.update({
                path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
                fingerprint,
                requestBody: createOrUpdateConfig,
              });
            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!environmentId) {
              throw new Error(`environmentId is required for ${action} action`);
            }
            await tagmanager.accounts.containers.environments.delete({
              path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Environment ${environmentId} was successfully deleted`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "reauthorize": {
            if (!environmentId) {
              throw new Error(`environmentId is required for ${action} action`);
            }
            const response =
              await tagmanager.accounts.containers.environments.reauthorize({
                path: `accounts/${accountId}/containers/${containerId}/environments/${environmentId}`,
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
          `Error performing ${action} on environment`,
          error,
        );
      }
    },
  );
};
