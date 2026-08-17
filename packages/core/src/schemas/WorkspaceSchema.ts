import { z } from "zod";

/**
 * Workspace resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces#Workspace
 */

// Clean schema for merged tools (writable fields only)
export const WorkspaceSchema = z.object({
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z
    .string()
    .optional()
    .describe("The Workspace ID uniquely identifies the GTM Workspace."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Workspace as computed at storage time. This value is recomputed whenever the workspace is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  name: z.string().optional().describe("Workspace display name."),
  description: z.string().optional().describe("Workspace description."),
});
