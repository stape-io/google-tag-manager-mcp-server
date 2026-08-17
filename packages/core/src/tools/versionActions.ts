import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "@googleapis/tagmanager";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { ContainerVersionSchema } from "../schemas/ContainerVersionSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  ITEMS_PER_PAGE,
  log,
  processVersionData,
  ResourceType,
} from "../utils/index.js";
import Schema$ContainerVersion = tagmanager_v2.Schema$ContainerVersion;

const PayloadSchema = ContainerVersionSchema.omit({
  accountId: true,
  containerId: true,
  containerVersionId: true,
});

export const versionActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_version",
    `Performs all container version operations: get, live, publish, remove, setLatest, undelete, update. For 'get' and 'live' actions, use 'resourceType' to paginate specific resource arrays (up to ${ITEMS_PER_PAGE} items per page) to avoid response truncation.`,
    {
      action: z
        .enum([
          "get",
          "live",
          "publish",
          "remove",
          "setLatest",
          "undelete",
          "update",
        ])
        .describe(
          "The container version operation to perform. Must be one of: 'get', 'live', 'publish', 'remove', 'setLatest', 'undelete', 'update'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the container version.",
        ),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container containing the version."),
      containerVersionId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM container version. Required for 'get', 'publish', 'remove', 'setLatest', 'undelete', and 'update' actions.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM container version resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. Required for 'publish' and 'update' actions.",
        ),
      resourceType: z
        .enum([
          "tag",
          "trigger",
          "variable",
          "folder",
          "builtInVariable",
          "zone",
          "customTemplate",
          "client",
          "gtagConfig",
          "transformation",
        ])
        .optional()
        .describe(
          "Specific resource type to retrieve with pagination (only for 'get' and 'live' actions). If not specified, returns summary with sample items.",
        ),
      page: z
        .number()
        .min(1)
        .default(1)
        .describe(
          "Page number for pagination (starts from 1). Only used when resourceType is specified.",
        ),
      itemsPerPage: z
        .number()
        .min(1)
        .max(ITEMS_PER_PAGE)
        .default(ITEMS_PER_PAGE)
        .describe(
          `Number of items to return per page (1-${ITEMS_PER_PAGE}). Only used when resourceType is specified.`,
        ),
      includeSummary: z
        .boolean()
        .default(true)
        .describe(
          "Include counts and metadata for all resource types. Only used when resourceType is specified.",
        ),
    },
    async ({
      action,
      accountId,
      containerId,
      containerVersionId,
      createOrUpdateConfig,
      fingerprint,
      resourceType,
      page,
      itemsPerPage,
      includeSummary,
    }) => {
      log(`Running tool: gtm_version with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "get": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
            }

            const response = await tagmanager.accounts.containers.versions.get({
              path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
            });

            const processedData = processVersionData(
              response.data,
              resourceType as ResourceType | undefined,
              page,
              itemsPerPage,
              includeSummary,
            );

            return {
              content: [
                { type: "text", text: JSON.stringify(processedData, null, 2) },
              ],
            };
          }
          case "live": {
            const response = await tagmanager.accounts.containers.versions.live(
              {
                parent: `accounts/${accountId}/containers/${containerId}`,
              },
            );

            const processedData = processVersionData(
              response.data,
              resourceType as ResourceType | undefined,
              page,
              itemsPerPage,
              includeSummary,
            );

            return {
              content: [
                { type: "text", text: JSON.stringify(processedData, null, 2) },
              ],
            };
          }
          case "publish": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.versions.publish({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
                fingerprint,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
            }

            await tagmanager.accounts.containers.versions.delete({
              path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Container version ${containerVersionId} was successfully deleted`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "setLatest": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.versions.set_latest({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "undelete": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.versions.undelete({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "update": {
            if (!containerVersionId) {
              throw new Error(
                `containerVersionId is required for ${action} action`,
              );
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
              await tagmanager.accounts.containers.versions.update({
                path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$ContainerVersion,
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
          `Error performing ${action} on container version`,
          error,
        );
      }
    },
  );
};
