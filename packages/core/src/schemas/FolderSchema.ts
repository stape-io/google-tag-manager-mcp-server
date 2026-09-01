import { z } from "zod";

export const FolderSchema = z.object({
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  folderId: z
    .string()
    .optional()
    .describe("The Folder ID uniquely identifies the GTM Folder."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Folder as computed at storage time. This value is recomputed whenever the folder is modified.",
    ),
  name: z.string().optional().describe("Folder display name."),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this folder in the container."),
});
