import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const setLatest = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_set_latest_container_version",
    "Sets the latest container version used for synchronization of workspaces",
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
        .describe(
          "The unique ID of the GTM Container Version to set as latest.",
        ),
    },
    async ({
      accountId,
      containerId,
      containerVersionId,
    }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_set_latest_container_version for account ${accountId}, container ${containerId}, version ${containerVersionId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response =
          await tagmanager.accounts.containers.versions.set_latest({
            path: `accounts/${accountId}/containers/${containerId}/versions/${containerVersionId}`,
          });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error setting latest container version ${containerVersionId} in container ${containerId} for account ${accountId}`,
          error,
        );
      }
    },
  );
