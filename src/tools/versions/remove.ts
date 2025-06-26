import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const remove = (server: McpServer): void =>
  server.tool(
    "tag_manager_delete_container_version",
    "Deletes a Container Version",
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
        .describe("The unique ID of the GTM Container Version to delete."),
    },
    async ({
      accountId,
      containerId,
      containerVersionId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_delete_container_version for account ${accountId}, container ${containerId}, version ${containerVersionId}`,
      );
      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containerversions",
        ]);
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
      } catch (error) {
        return createErrorResponse(
          `Error deleting container version ${containerVersionId} from container ${containerId} in account ${accountId}`,
          error,
        );
      }
    },
  );
