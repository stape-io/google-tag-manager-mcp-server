import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { z } from "zod";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import { ZoneSchema } from "../schemas/ZoneSchema";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils";
import Schema$Zone = tagmanager_v2.Schema$Zone;

const PayloadSchema = ZoneSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  zoneId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 20;

export const zoneActions = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "gtm_zone",
    `Performs various zone operations including create, get, list, update, remove, and revert actions. The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum(["create", "get", "list", "update", "remove", "revert"])
        .describe(
          "The zone operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'revert'.",
        ),
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the zone."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the zone."),
      workspaceId: z
        .string()
        .describe("The unique ID of the GTM Workspace containing the zone."),
      zoneId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM Zone. Required for all actions except 'create' and 'list'.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM zone resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "Fingerprint for optimistic concurrency control. Required for 'update' and 'revert' actions.",
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
      zoneId,
      createOrUpdateConfig,
      fingerprint,
      page,
      itemsPerPage,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: gtm_zone for action '${action}' on account ${accountId}, container ${containerId}, workspace ${workspaceId}${
          zoneId ? `, zone ${zoneId}` : ""
        }`,
      );

      try {
        const tagmanager = await getTagManagerClient(props);

        switch (action) {
          case "create": {
            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.workspaces.zones.create({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: createOrUpdateConfig as Schema$Zone,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "get": {
            if (!zoneId) {
              throw new Error(`zoneId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.zones.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "list": {
            let all: Schema$Zone[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.workspaces.zones.list({
                  parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                  pageToken: currentPageToken,
                });

              if (response.data.zone) {
                all = all.concat(response.data.zone);
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
            if (!zoneId) {
              throw new Error(`zoneId is required for ${action} action`);
            }

            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.workspaces.zones.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$Zone,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "remove": {
            if (!zoneId) {
              throw new Error(`zoneId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.zones.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Zone ${zoneId} removed successfully from workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          case "revert": {
            if (!zoneId) {
              throw new Error(`zoneId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.zones.revert({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/zones/${zoneId}`,
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
          `Error performing ${action} action on zone${
            zoneId ? ` ${zoneId}` : ""
          } in workspace ${workspaceId} for container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
};
