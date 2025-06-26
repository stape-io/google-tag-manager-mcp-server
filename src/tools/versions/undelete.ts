import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const undelete = (server: McpServer): void =>
  server.tool(
    "tag_manager_undelete_container_version",
    "Undeletes a Container Version",
    {
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
        .describe("The unique ID of the GTM Container Version to undelete."),
    },
    async ({
      accountId,
      containerId,
      containerVersionId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_undelete_container_version for account ${accountId}, container ${containerId}, version ${containerVersionId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        ]);
        const response = await tagmanager.accounts.containers.versions.undelete(
          {
            path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
          },
        );

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error undeleting container version ${containerVersionId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
