import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GtmToolContext } from "../types/index.js";
import { AccountSchema } from "../schemas/AccountSchema.js";
import {
  createErrorResponse,
  getTagManagerClient,
  log,
} from "../utils/index.js";

const PayloadSchema = AccountSchema.omit({
  accountId: true,
});

export const accountActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.tool(
    "gtm_account",
    "Performs all account-related operations: get, list, update. Use the 'action' parameter to select the operation.",
    {
      action: z
        .enum(["get", "list", "update"])
        .describe(
          "The account operation to perform. Must be one of: 'get', 'list', 'update'.",
        ),
      accountId: z.string().describe("The unique ID of the GTM Account."),
      config: PayloadSchema.optional().describe(
        "Configuration for 'update' action. All fields correspond to the GTM Account resource.",
      ),
    },
    async ({ action, accountId, config }) => {
      log(`Running tool: gtm_account with action ${action}`);

      try {
        const tagmanager = await getTagManagerClient(auth);

        switch (action) {
          case "get": {
            if (!accountId) {
              throw new Error(`accountId is required for ${action} action`);
            }

            const response = await tagmanager.accounts.get({
              path: `accounts/${accountId}`,
            });
            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "list": {
            const response = await tagmanager.accounts.list({});
            return {
              content: [
                { type: "text", text: JSON.stringify(response.data, null, 2) },
              ],
            };
          }
          case "update": {
            if (!accountId) {
              throw new Error(`accountId is required for ${action} action`);
            }

            if (!config) {
              throw new Error(`config is required for ${action} action`);
            }

            const response = await tagmanager.accounts.update({
              path: `accounts/${accountId}`,
              requestBody: config,
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
          `Error performing ${action} on account`,
          error,
        );
      }
    },
  );
};
