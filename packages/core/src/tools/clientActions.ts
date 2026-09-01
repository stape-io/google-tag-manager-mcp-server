import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { ClientSchema } from "../schemas/ClientSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";
import Schema$Client = tagmanager_v2.Schema$Client;

const PayloadSchema = ClientSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  clientId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 50;

export const clientActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_client",
    `Performs all client operations: create, get, list, update, remove, revert. The 'list' action returns up to itemsPerPage items per page.`,
    {
      action: z
        .enum(["create", "get", "list", "update", "remove", "revert"])
        .describe(
          "The client operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
        ),
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the client."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the client."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the client."),
      clientId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM Client. Required for 'get', 'update', 'remove', and 'revert' actions.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM Client resource, except IDs.",
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
      clientId,
      createOrUpdateConfig,
      fingerprint,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_client with action ${action}`);

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
              await tagmanager.accounts.containers.workspaces.clients.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: createOrUpdateConfig as Schema$Client,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!clientId) {
              throw new Error(`clientId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.clients.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            let all: Schema$Client[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.workspaces.clients.list({
                  parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                  pageToken: currentPageToken,
                });

              if (response.data.client) {
                all = all.concat(response.data.client);
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
            if (!clientId) {
              throw new Error(`clientId is required for ${action} action`);
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
              await tagmanager.accounts.containers.workspaces.clients.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$Client,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!clientId) {
              throw new Error(`clientId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.clients.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Client ${clientId} was successfully deleted`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "revert": {
            if (!clientId) {
              throw new Error(`clientId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.clients.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/clients/${clientId}`,
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
          `Error performing ${action} on client`,
          error,
        );
      }
    },
  );
};
