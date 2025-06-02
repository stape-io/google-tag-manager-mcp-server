import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { TAG_MANAGER_REMOVE_MCP_SERVER_DATA } from "../constants/tools";
import { log } from "./log";

export function createErrorResponse(
  message: string,
  error?: any,
): CallToolResult {
  let detailedMessage = "";

  if (error?.code) {
    if (error.code === 401) {
      detailedMessage = `It seems that your token has been expired, please use ${TAG_MANAGER_REMOVE_MCP_SERVER_DATA} tool to clear your session in the MCP client`;
    } else {
      const messages = (error?.errors || []).map(
        (item: { massage?: string }) => item?.massage,
      );

      detailedMessage = `${message}: Google API Error ${error.code} - ${messages.join(". ")}`;
    }
  } else if (error instanceof Error) {
    detailedMessage = `${message}: ${error.message}`;
  } else {
    detailedMessage = `${message}: ${String(error)}`;
  }

  log("MCP Tool Error:", detailedMessage); // Log errors to stderr

  return {
    isError: true,
    content: [{ type: "text", text: detailedMessage }],
  };
}
