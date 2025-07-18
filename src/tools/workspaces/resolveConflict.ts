import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tagmanager_v2 } from "googleapis";
import { z } from "zod";
import { BuiltInVariableSchemaFields } from "../../schemas/BuiltInVariableSchema";
import { CustomTemplateSchemaFields } from "../../schemas/CustomTemplateSchema";
import { FolderSchemaFields } from "../../schemas/FolderSchema";
import { GtagConfigSchemaFields } from "../../schemas/GtagConfigSchema";
import { TagSchemaFields } from "../../schemas/TagSchema";
import { TransformationSchemaFields } from "../../schemas/TransformationSchema";
import { TriggerSchemaFields } from "../../schemas/TriggerSchema";
import { VariableSchemaFields } from "../../schemas/VariableSchema";
import { ZoneSchemaFields } from "../../schemas/ZoneSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";
import Schema$Entity = tagmanager_v2.Schema$Entity;

const EntitySchemaFields = z.union([
  z.object({ tag: z.object(TagSchemaFields) }),
  z.object({ trigger: z.object(TriggerSchemaFields) }),
  z.object({ variable: z.object(VariableSchemaFields) }),
  z.object({ folder: z.object(FolderSchemaFields) }),
  z.object({ client: z.object(TransformationSchemaFields) }),
  z.object({ transformation: z.object(TriggerSchemaFields) }),
  z.object({ zone: z.object(ZoneSchemaFields) }),
  z.object({ customTemplate: z.object(CustomTemplateSchemaFields) }),
  z.object({ builtInVariable: z.object(BuiltInVariableSchemaFields) }),
  z.object({ gtagConfig: z.object(GtagConfigSchemaFields) }),
]);

export const resolveConflict = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_resolve_workspace_conflict",
    "Resolves a merge conflict for a workspace entity",
    {
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
        .describe(
          "The unique ID of the GTM Workspace in which to resolve the conflict.",
        ),
      fingerprint: z
        .string()
        .describe("Fingerprint for optimistic concurrency control."),
      entity: EntitySchemaFields.describe("The resolved entity to update."),
      changeStatus: z
        .string()
        .describe(
          "The status of the change for the entity in the workspace. Possible values: 'added', 'modified', 'deleted', 'unmodified'. Indicates how the entity was affected by workspace changes.",
        ),
    },
    async ({
      accountId,
      containerId,
      workspaceId,
      fingerprint,
      entity,
      changeStatus,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_resolve_workspace_conflict for account ${accountId}, container ${containerId}, workspace ${workspaceId}`,
      );

      const entityName = Object.keys(entity);

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        await tagmanager.accounts.containers.workspaces.resolve_conflict({
          path: `accounts/${accountId}/containers/${containerId}/workspaces/${workspaceId}`,
          fingerprint,
          requestBody: {
            changeStatus,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
      } catch (error) {
        return createErrorResponse(
          `Error resolving conflict in workspace ${workspaceId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
