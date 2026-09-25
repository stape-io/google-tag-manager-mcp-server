export const TAG_MANAGER_REMOVE_MCP_SERVER_DATA = "gtm_remove_session";

// Shown to the model when Google rejects the stored credentials (401). After a
// refresh Google itself has dropped the token, so only a new sign-in helps.
export const UNAUTHORIZED_HINT =
  "Google rejected this session's credentials (401), so the GTM MCP server needs a new Google sign-in. Ask the user to reconnect the GTM MCP server in their MCP client (for a Claude connector: Settings > Connectors > reconnect it; for mcp-remote clients: restart the client and complete the sign-in that opens in the browser), then retry.";
