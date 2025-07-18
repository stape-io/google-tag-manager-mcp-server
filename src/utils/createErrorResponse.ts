import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { log } from "./log";

// --- Helper function for error messages ---
export function createErrorResponse(
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error?: any,
): CallToolResult {
  let detailedMessage = message;
  if (error) {
    // Try to recognize specific Google API errors
    if (error.code && error.details) {
      // Standard gRPC error structure
      detailedMessage = `${message}: Google API Error ${error.code} - ${error.details}`;
    } else if (error instanceof Error) {
      detailedMessage = `${message}: ${error.message}`;
    } else {
      detailedMessage = `${message}: ${String(error)}`;
    }
  }
  log("MCP Tool Error:", detailedMessage); // Log errors to stderr

  return {
    isError: true,
    content: [{ type: "text", text: detailedMessage }],
  };
}
