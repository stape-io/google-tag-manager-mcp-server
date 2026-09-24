import { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { GTM_API_SCOPES } from "../constants/index.js";
import { GtmToolContext } from "../types/index.js";
import {
  createErrorResponse,
  getUnauthorizedHint,
  log,
} from "../utils/index.js";

const TOKEN_INFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const TOKEN_INFO_TIMEOUT_MS = 10_000;

function toResult(status: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
  };
}

export const authStatusActions = (
  server: McpServer,
  { auth }: GtmToolContext,
): void => {
  server.registerTool(
    "gtm_auth_status",
    {
      description:
        "Diagnoses this server's Google credentials: whether an access token can be obtained, whether Google accepts it, which Tag Manager scopes it grants and how long until it expires. Call it when other GTM tools fail with 401/403 errors, before retrying. Never returns the token itself and makes no Tag Manager API calls.",
    },
    async (): Promise<CallToolResult> => {
      log("Running tool: gtm_auth_status");

      let token: string;
      try {
        token = await auth.getAccessToken();
      } catch (error) {
        return toResult({
          authenticated: false,
          // No hint: nothing reached Google, the error itself is the diagnosis.
          error: `Could not obtain an access token: ${error instanceof Error ? error.message : String(error)}`,
        });
      }

      try {
        // POSTed so the token stays out of URLs and request logs.
        const response = await fetch(TOKEN_INFO_URL, {
          method: "POST",
          body: new URLSearchParams({ access_token: token }),
          signal: AbortSignal.timeout(TOKEN_INFO_TIMEOUT_MS),
        });

        if (response.status === 400 || response.status === 401) {
          return toResult({
            authenticated: false,
            error: `Google rejected the access token (tokeninfo HTTP ${response.status}).`,
            hint: getUnauthorizedHint(),
          });
        }

        // A 429/5xx says nothing about the token - and the re-auth hint could
        // lead to wiping a valid session.
        if (!response.ok) {
          return toResult({
            authenticated: "unknown",
            error: `Could not verify the access token: tokeninfo HTTP ${response.status}. Try again shortly.`,
          });
        }

        const info = (await response.json()) as {
          scope?: string;
          expires_in?: string | number;
          email?: string;
        };
        const granted = (info.scope ?? "").split(" ").filter(Boolean);
        const missingScopes = GTM_API_SCOPES.filter(
          (scope) => !granted.includes(scope),
        );

        return toResult({
          authenticated: true,
          email: info.email,
          expiresInSeconds:
            info.expires_in === undefined ? undefined : Number(info.expires_in),
          grantedScopes: granted.filter((scope) =>
            scope.includes("/auth/tagmanager."),
          ),
          missingScopes,
          ...(missingScopes.length && {
            missingScopesNote:
              "Scopes this server can use that the token was not granted. Actions that need only these fail with 403, not 401. Edit scopes also allow reading, and a deliberately narrowed GTM_SCOPES is expected to leave some here.",
          }),
        });
      } catch (error) {
        return createErrorResponse("Error checking Google credentials", error);
      }
    },
  );
};
