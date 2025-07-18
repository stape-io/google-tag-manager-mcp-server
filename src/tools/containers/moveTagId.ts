import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const moveTagId = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_move_tag_id",
    "Moves a Tag ID out of a Container",
    {
      accountId: z
        .string()
        .describe("The unique ID of the GTM Account containing the container."),
      containerId: z
        .string()
        .describe("The unique ID of the GTM Container to retrieve."),
      tagId: z
        .string()
        .describe("Tag ID to be removed from the current Container"),
      tagName: z
        .string()
        .optional()
        .describe("The name for the newly created tag"),
      allowUserPermissionFeatureUpdate: z
        .boolean()
        .optional()
        .describe(
          "Must be set to true to allow features.user_permissions to change from false to true.",
        ),
      copySettings: z
        .boolean()
        .optional()
        .describe(
          "Whether or not to copy tag settings from this tag to the new tag.",
        ),
      copyTermsOfService: z
        .boolean()
        .optional()
        .describe(
          "Must be set to true to accept all terms of service agreements copied from the current tag to the newly created tag.",
        ),
      copyUsers: z
        .boolean()
        .optional()
        .describe("Whether or not to copy users from this tag to the new tag."),
    },
    async ({
      accountId,
      containerId,
      tagId,
      tagName,
      allowUserPermissionFeatureUpdate,
      copySettings,
      copyTermsOfService,
      copyUsers,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_move_tag_id for accountId ${accountId}, containerId ${containerId}, tagId ${tagId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.move_tag_id({
          path: `accounts/${accountId}/containers/${containerId}`,
          tagId,
          tagName,
          allowUserPermissionFeatureUpdate,
          copySettings,
          copyTermsOfService,
          copyUsers,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error moving tag ID ${tagId} at accountId ${accountId}, containerId ${containerId}, tagId ${tagId}`,
          error,
        );
      }
    },
  );
