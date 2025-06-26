import { z } from "zod";

/**
 * Workspace resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces#Workspace
 */
export const WorkspaceSchemaFields = {
  accountId: z.string().optional().describe("GTM Account ID."),
  containerId: z.string().optional().describe("GTM Container ID."),
  workspaceId: z
    .string()
    .optional()
    .describe("The Workspace ID uniquely identifies the GTM Workspace."),
  name: z.string().optional().describe("Workspace display name."),
  description: z.string().optional().describe("Workspace description."),
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
};
