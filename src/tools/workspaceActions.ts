import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { z } from "zod";
import { McpAgentToolParamsModel } from "../models/McpAgentModel";
import { BuiltInVariableSchema } from "../schemas/BuiltInVariableSchema";
import { CustomTemplateSchema } from "../schemas/CustomTemplateSchema";
import { FolderSchema } from "../schemas/FolderSchema";
import { GtagConfigSchema } from "../schemas/GtagConfigSchema";
import { TagSchema } from "../schemas/TagSchema";
import { TransformationSchema } from "../schemas/TransformationSchema";
import { TriggerSchema } from "../schemas/TriggerSchema";
import { VariableSchema } from "../schemas/VariableSchema";
import { WorkspaceSchema } from "../schemas/WorkspaceSchema";
import { ZoneSchema } from "../schemas/ZoneSchema";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
  paginateArray,
} from "../utils";
import Schema$Entity = tagmanager_v2.Schema$Entity;
import Schema$Workspace = tagmanager_v2.Schema$Workspace;

const EntitySchema = z.union([
  z.object({ tag: TagSchema }),
  z.object({ trigger: TriggerSchema }),
  z.object({ variable: VariableSchema }),
  z.object({ folder: FolderSchema }),
  z.object({ client: TransformationSchema }),
  z.object({ transformation: TransformationSchema }),
  z.object({ zone: ZoneSchema }),
  z.object({ customTemplate: CustomTemplateSchema }),
  z.object({ builtInVariable: BuiltInVariableSchema }),
  z.object({ gtagConfig: GtagConfigSchema }),
]);

const PayloadSchema = WorkspaceSchema.omit({
  accountId: true,
  containerId: true,
  workspaceId: true,
  fingerprint: true,
});

const ITEMS_PER_PAGE = 50;

export const workspaceActions = (
  server: McpServer,
  { props }: McpAgentToolParamsModel,
): void => {
  server.tool(
    "gtm_workspace",
    `Performs various workspace operations including create, get, list, update, remove, createVersion, getStatus, sync, quickPreview, and resolveConflict actions. The 'list' action returns up to ${ITEMS_PER_PAGE} items per page.`,
    {
      action: z
        .enum([
          "create",
          "get",
          "list",
          "update",
          "remove",
          "createVersion",
          "getStatus",
          "sync",
          "quickPreview",
          "resolveConflict",
        ])
        .describe(
          "The workspace operation to perform. Must be one of: 'create', 'get', 'list', 'update', 'remove', 'createVersion', 'getStatus', 'sync', 'quickPreview', 'resolveConflict'.",
        ),
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the workspace."),
      containerId: z
        .string()
        .describe(
          "The unique ID of the GTM Container containing the workspace.",
        ),
      workspaceId: z
        .string()
        .optional()
        .describe(
          "The unique ID of the GTM Workspace. Required for all actions except 'create' and 'list'.",
        ),
      createOrUpdateConfig: PayloadSchema.optional().describe(
        "Configuration for 'create' and 'update' actions. All fields correspond to the GTM workspace resource, except IDs.",
      ),
      fingerprint: z
        .string()
        .optional()
        .describe(
          "Fingerprint for optimistic concurrency control. Required for 'update' and 'resolveConflict' actions.",
        ),
      entity: EntitySchema.optional().describe(
        "The resolved entity for 'resolveConflict' action.",
      ),
      changeStatus: z
        .string()
        .optional()
        .describe(
          "The status of the change for the entity in the workspace for 'resolveConflict' action. Possible values: 'added', 'modified', 'deleted', 'unmodified'.",
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
      createOrUpdateConfig,
      fingerprint,
      entity,
      changeStatus,
      page,
      itemsPerPage,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: gtm_workspace for action '${action}' on account ${accountId}, container ${containerId}${
          workspaceId ? `, workspace ${workspaceId}` : ""
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
              await tagmanager.accounts.containers.workspaces.create({
                parent: `accounts/${accountId}/containers/${containerId}`,
                requestBody: createOrUpdateConfig as Schema$Workspace,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "get": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.get({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "list": {
            let all: Schema$Workspace[] = [];
            let currentPageToken = "";

            do {
              const response =
                await tagmanager.accounts.containers.workspaces.list({
                  parent: `accounts/${accountId}/containers/${containerId}`,
                  pageToken: currentPageToken,
                });

              if (response.data.workspace) {
                all = all.concat(response.data.workspace);
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
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            if (!createOrUpdateConfig) {
              throw new Error(
                `createOrUpdateConfig is required for ${action} action`,
              );
            }

            const response =
              await tagmanager.accounts.containers.workspaces.update({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                fingerprint,
                requestBody: createOrUpdateConfig as Schema$Workspace,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "remove": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            await tagmanager.accounts.containers.workspaces.delete({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Workspace ${workspaceId} removed successfully from container ${containerId} for account ${accountId}`,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          case "createVersion": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.create_version({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
                requestBody: createOrUpdateConfig || {},
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "getStatus": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.getStatus({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "sync": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.sync({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "quickPreview": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            const response =
              await tagmanager.accounts.containers.workspaces.quick_preview({
                path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              });

            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }

          case "resolveConflict": {
            if (!workspaceId) {
              throw new Error(`workspaceId is required for ${action} action`);
            }

            if (!fingerprint) {
              throw new Error(`fingerprint is required for ${action} action`);
            }

            if (!entity) {
              throw new Error(`entity is required for ${action} action`);
            }

            if (!changeStatus) {
              throw new Error(`changeStatus is required for ${action} action`);
            }

            const entityName = Object.keys(entity);

            await tagmanager.accounts.containers.workspaces.resolve_conflict({
              path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
              fingerprint,
              requestBody: {
                changeStatus,
                // @ts-expect-error
                [entityName[0]]: entity[entityName[0]],
              } as Schema$Entity,
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      message: `Conflict resolved in workspace ${workspaceId} for account ${accountId}`,
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
          `Error performing ${action} action on workspace${
            workspaceId ? ` ${workspaceId}` : ""
          } in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
};
