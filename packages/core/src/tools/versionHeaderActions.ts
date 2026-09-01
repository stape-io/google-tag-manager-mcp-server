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
import Schema$ContainerVersionHeader = tagmanager_v2.Schema$ContainerVersionHeader;

const ITEMS_PER_PAGE = 50;

export const versionHeaderActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_version_header",
    `Performs all container version header operations: list, latest. The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum(["list", "latest"])
        .describe(
          "The container version header operation to perform. Must be one of: 'list', 'latest'.",
        ),
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the container."),
      containerId: z.string().describe("The unique ID of the GTM Container."),
      includeDeleted: z
        .boolean()
        .optional()
        .describe(
          "Whether to also retrieve deleted (archived) versions. Required for 'list' action.",
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
      includeDeleted,
      page,
      itemsPerPage,
    }) => {
      log(`Running tool: gtm_version_header with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "list": {
            if (includeDeleted === undefined) {
              throw new Error(
                `includeDeleted is required for ${action} action`,
              );
            }

            let all: Schema$ContainerVersionHeader[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.version_headers.list({
                  parent: `accounts/${accountId}/containers/${containerId}`,
                  includeDeleted,
                  pageToken: currentPageToken,
                });

              if (response.data.containerVersionHeader) {
                all = all.concat(response.data.containerVersionHeader);
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
          case "latest": {
            const response =
              await tagmanager.accounts.containers.version_headers.latest({
                parent: `accounts/${accountId}/containers/${containerId}`,
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
          `Error performing ${action} on container version header`,
          error,
        );
      }
    },
  );
};
