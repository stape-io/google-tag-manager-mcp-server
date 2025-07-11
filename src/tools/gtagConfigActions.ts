import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tagmanager_v2 } from "googleapis";
import { z } from "zod";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import { GtagConfigSchema } from "../schemas/GtagConfigSchema";
import { createErrorResponse, getTagManagerClient, log } from "../utils";
import Schema$GtagConfig = tagmanager_v2.Schema$GtagConfig;

const PayloadSchema = GtagConfigSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  gtagConfigId: true,
  fingerprint: true,
});

export const gtagConfigActions = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "gtm_gtag_config",
    "Performs all Google tag config operations: create, get, list, update, remove. Use the 'action' parameter to select the operation.",
    {
      action: z
        .enum(["create", "get", "list", "update", "remove"])
        .describe(
          "The Google tag config operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove'.",
        ),
      accountId: z
        .string()
        .describe(
          "The unique ID of the GTM Account containing the Google tag config.",
        ),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the Google tag config.",
        ),
      workspaceId: z
        .string()
        .describe(
          "The unique ID of the GTM Workspace containing the Google tag config.",
        ),
      gtagConfigId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the Google tag config. Required for 'get', 'update', and 'remove' actions.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the Google tag config resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "The fingerprint for optimistic concurrency control. Required for 'update' action.",
        ),
      pageToken: z
        .string()
        .optional()
        .describe("A token for pagination. Optional for 'list' action."),
    },
    async ({
      action,
      accountId,
      containerId,
      workspaceId,
      gtagConfigId,
      createOrUpdateConfig,
      fingerprint,
      pageToken,
    }) => {
      log(`Running tool: gtm_gtag_config with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(props.accessToken);

        switch (action) {
          case "create": {
            if (!createOrUpdateConfig) {
              throw new Error(`config is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.gtag_config.create(
                {
                  parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                  requestBody: createOrUpdateConfig as Schema$GtagConfig,
                },
              );

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "get": {
            if (!gtagConfigId) {
              throw new Error(`gtagConfigId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.gtag_config.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            const response =
              await tagmanager.accounts.containers.workspaces.gtag_config.list({
                parent: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                pageToken,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "update": {
            if (!gtagConfigId) {
              throw new Error(`gtagConfigId is required for ${action} action`);
            }

            if (!createOrUpdateConfig) {
              throw new Error(`config is required for ${action} action`);
            }

            if (!fingerprint) {
              throw new Error(`fingerprint is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.gtag_config.update(
                {
                  path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
                  fingerprint,
                  requestBody: createOrUpdateConfig as Schema$GtagConfig,
                },
              );

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "remove": {
            if (!gtagConfigId) {
              throw new Error(`gtagConfigId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.gtag_config.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}/gtag_config/${gtagConfigId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Google tag config ${gtagConfigId} was successfully deleted`,
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
          `Error performing ${action} on Google tag config`,
          error,
        );
      }
    },
  );
};
