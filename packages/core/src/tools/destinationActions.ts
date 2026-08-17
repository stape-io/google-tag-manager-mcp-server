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
import Schema$Destination = tagmanager_v2.Schema$Destination;

const ITEMS_PER_PAGE = 50;

export const destinationActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_destination",
    `Performs all destination operations: get, list, link, unlink.  The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum(["get", "list", "link", "unlink"])
        .describe(
          "The destination operation to perform. Must be one of: 'get', 'list', 'link', 'unlink'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destination.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the destination.",
        ),
      destinationId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM Destination. Required for 'get', 'link', and 'unlink' actions.",
        ),
      allowUserPermissionFeatureUpdate: z
        .boolean()
        .optional()
        .describe(
          "If true, allows user permission feature update during linking. Optional for 'link' action.",
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
      destinationId,
      allowUserPermissionFeatureUpdate,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_destination with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "get": {
            if (!destinationId) {
              throw new Error(`destinationId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.destinations.get({
                path: `accounts/${accountId}/containers/${containerId}/destinations/${destinationId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            const response =
              await tagmanager.accounts.containers.destinations.list({
                parent: `accounts/${accountId}/containers/${containerId}`,
              });

            const all = response.data as Schema$Destination[];
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
          case "link": {
            if (!destinationId) {
              throw new Error(`destinationId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.destinations.link({
                parent: `accounts/${accountId}/containers/${containerId}`,
                destinationId,
                allowUserPermissionFeatureUpdate,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "unlink": {
            if (!destinationId) {
              throw new Error(`destinationId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.destinations.link({
              parent: `accounts/${accountId}/containers/${containerId}`,
              destinationId: destinationId,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Destination ${destinationId} was successfully unlinked`,
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
          `Error performing ${action} on destination`,
          error,
        );
      }
    },
  );
};
