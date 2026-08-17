import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { CustomTemplateSchema } from "../schemas/CustomTemplateSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";
import Schema$CustomTemplate = tagmanager_v2.Schema$CustomTemplate;

const PayloadSchema = CustomTemplateSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  templateId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 20;

export const templateActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_template",
    `Performs all GTM custom template operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    {
      action: z
        .enum(["create", "get", "list", "update", "remove", "revert"])
        .describe(
          "The GTM custom template operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the custom template.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the custom template.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the custom template.",
        ),
      templateId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM custom template. Required for 'get', 'update', 'remove', and 'revert' actions.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM custom template resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. Required for 'update' and 'revert' actions.",
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
      workspaceId,
      templateId,
      createOrUpdateConfig,
      fingerprint,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_template with action ${action}`);

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
              await tagmanager.accounts.containers.workspaces.templates.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: createOrUpdateConfig as Schema$CustomTemplate,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!templateId) {
              throw new Error(`templateId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.templates.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            let all: Schema$CustomTemplate[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.workspaces.templates.list({
                  parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                  pageToken: currentPageToken,
                });
              if (response.data.template) {
                all = all.concat(response.data.template);
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
            if (!templateId) {
              throw new Error(`templateId is required for ${action} action`);
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
              await tagmanager.accounts.containers.workspaces.templates.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$CustomTemplate,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!templateId) {
              throw new Error(`templateId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.templates.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Template ${templateId} was successfully deleted`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "revert": {
            if (!templateId) {
              throw new Error(`templateId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.templates.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/templates/${templateId}`,
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
          `Error performing ${action} on GTM custom template`,
          error,
        );
      }
    },
  );
};
