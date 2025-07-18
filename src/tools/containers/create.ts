import {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ContainerSchemaFields } from "../../schemas/ContainerSchema";
import { createErrorResponse, getTagManagerClient, log } from "../../utils";

export const create = (server: McpServer): RegisteredTool =>
  server.tool(
    "tag_manager_create_container",
    "Creates a new container in the specified GTM account",
    ContainerSchemaFields,
    async ({ accountId, ...rest }): Promise<CallToolResult> => {
      log(
        `Running tool: tag_manager_create_container for account ${accountId}`,
      );

      try {
        const tagmanager = await getTagManagerClient([
          "https://www.googleapis.com/auth/tagmanager.edit.containers",
        ]);
        const response = await tagmanager.accounts.containers.create({
          parent: `accounts/${accountId}`,
          requestBody: rest,
        });

        return {
          content: [
            { type: "text", text: JSON.stringify(response.data, null, 2) },
          ],
        };
      } catch (error) {
        return createErrorResponse(
          `Error creating container in account ${accountId}`,
          error,
        );
      }
    },
  );
