import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./log.js";

const DEFAULT_UNAUTHORIZED_HINT =
  "Google rejected the credentials (401). The access token is invalid or expired - re-authenticate and try again.";

let unauthorizedHint = DEFAULT_UNAUTHORIZED_HINT;

/** How a 401 is recovered from differs per server, so the hint is theirs to set. */
export function setUnauthorizedHint(hint: string): void {
  unauthorizedHint = hint;
}

export function createErrorResponse(
  message: string,
  error?: any,
): CallToolResult {
  let detailedMessage = "";

  if (error?.code) {
    if (error.code === 401) {
      detailedMessage = unauthorizedHint;
    } else {
      const messages = (error?.errors || []).map(
        (item: { message?: string }) => item?.message,
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
