import { z } from "zod";

export const GalleryReferenceSchema = z.object({
  host: z
    .string()
    .optional()
    .describe("The name of the host for the community gallery template."),
  owner: z
    .string()
    .optional()
    .describe("The name of the owner for the community gallery template."),
  repository: z
    .string()
    .optional()
    .describe("The name of the repository for the community gallery template."),
  version: z
    .string()
    .optional()
    .describe("The version of the community gallery template."),
  isModified: z
    .boolean()
    .optional()
    .describe("If a user has manually edited the community gallery template."),
  signature: z
    .string()
    .optional()
    .describe(
      "The signature of the community gallery template as computed at import time. This value is recomputed whenever the template is updated from the gallery.",
    ),
  templateDeveloperId: z
    .string()
    .optional()
    .describe(
      "The developer id of the community gallery template. This value is set whenever the template is created from the gallery.",
    ),
  galleryTemplateId: z
    .string()
    .optional()
    .describe(
      "ID for the gallery template that is generated once during first sync and travels with the template redirects.",
    ),
});

export const CustomTemplateSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  templateId: z
    .string()
    .optional()
    .describe(
      "The Custom Template ID uniquely identifies the GTM custom template.",
    ),
  name: z.string().optional().describe("Custom Template display name."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Custom Template as computed at storage time. This value is recomputed whenever the template is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  templateData: z
    .string()
    .optional()
    .describe("The custom template in text format."),
  galleryReference: GalleryReferenceSchema.optional().describe(
    "A reference to the Community Template Gallery entry.",
  ),
};
