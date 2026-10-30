import { CallToolResult } from "@modelcontextprotocol/server";
import { log } from "./log.js";

const DEFAULT_UNAUTHORIZED_HINT =
  "Google rejected the credentials (401). The access token is invalid or expired - re-authenticate and try again.";

let unauthorizedHint = DEFAULT_UNAUTHORIZED_HINT;

/** How a 401 is recovered from differs per server, so the hint is theirs to set. */
export function setUnauthorizedHint(hint: string): void {
  unauthorizedHint = hint;
}

export function getUnauthorizedHint(): string {
  return unauthorizedHint;
}

export function createErrorResponse(
  message: string,
  error?: unknown,
): CallToolResult {
  const apiError = error as
    | (Partial<Error> & {
        code?: string | number;
        errors?: { message?: string }[];
      })
    | undefined;
  let detailedMessage = "";

  if (apiError?.code) {
    if (apiError.code === 401) {
      detailedMessage = unauthorizedHint;
    } else {
      const legacyMessages = (apiError?.errors || [])
        .map((item: { message?: string }) => item?.message)
        .filter(Boolean);

      const detail = legacyMessages.length
        ? legacyMessages.join(". ")
        : apiError?.message || "Unknown error";

      detailedMessage = `${message}: Google API Error ${apiError.code} - ${detail}`;
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
