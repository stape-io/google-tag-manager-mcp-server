import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils/index.js";

const ITEMS_PER_PAGE = 50;

export const destinationActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtag_destination",
    `Lists the Google Tag destinations listed under https://tagmanager.google.com/#/home#tags. This is not the classic GTM "destination" concept from the tagmanager.google.com UI; passing a regular GTM Container ID here typically returns no results. It only returns data for Google Tag IDs, i.e. the tags listed under tagmanager.google.com/#/home#tags. Returns up to ${ITEMS_PER_PAGE} items per page. Note: this is the only action the underlying Google API still supports; 'get' and 'link' are deprecated by Google, and 'unlink' was never part of the API.`,
    {
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the destination.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container (or Google Tag) containing the destination.",
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
    async ({ accountId, containerId, page, itemsPerPage }) => {
      log(`Running tool: gtag_destination with action list`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        const response = await tagmanager.accounts.containers.destinations.list(
          {
            parent: `accounts/${accountId}/containers/${containerId}`,
          },
        );

        // ponytail: the API returns `{}` (no `destination` key) when there are no results,
        // instead of `{ destination: [] }`.
        const all = response.data.destination ?? [];
        const paginatedResult = paginateArray(all, page, itemsPerPage);

        return {
          content: [
            { type: "text", text: JSON.stringify(paginatedResult, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          "Error performing list on destination",
          error,
        );
      }
    },
  );
};
