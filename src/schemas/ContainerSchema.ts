import { z } from "zod";

/**
 * Container resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers#Container
 */
export const ContainerFeaturesSchema = z.object({
  supportUserPermissions: z
    .boolean()
    .optional()
    .describe(
      "Whether this Container supports user permissions managed by GTM.",
    ),
  supportEnvironments: z
    .boolean()
    .optional()
    .describe("Whether this Container supports environments."),
  supportWorkspaces: z
    .boolean()
    .optional()
    .describe("Whether this Container supports workspaces."),
  supportGtagConfigs: z
    .boolean()
    .optional()
    .describe("Whether this Container supports Google tag config."),
  supportBuiltInVariables: z
    .boolean()
    .optional()
    .describe("Whether this Container supports built-in variables."),
  supportClients: z
    .boolean()
    .optional()
    .describe("Whether this Container supports clients."),
  supportFolders: z
    .boolean()
    .optional()
    .describe("Whether this Container supports folders."),
  supportTags: z
    .boolean()
    .optional()
    .describe("Whether this Container supports tags."),
  supportTemplates: z
    .boolean()
    .optional()
    .describe("Whether this Container supports templates."),
  supportTriggers: z
    .boolean()
    .optional()
    .describe("Whether this Container supports triggers."),
  supportVariables: z
    .boolean()
    .optional()
    .describe("Whether this Container supports variables."),
  supportVersions: z
    .boolean()
    .optional()
    .describe("Whether this Container supports Container versions."),
  supportZones: z
    .boolean()
    .optional()
    .describe("Whether this Container supports zones."),
  supportTransformations: z
    .boolean()
    .optional()
    .describe("Whether this Container supports transformations."),
});

export const ContainerSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z
    .string()
    .optional()
    .describe("The Container ID uniquely identifies the GTM Container."),
  name: z.string().optional().describe("Container display name."),
  domainName: z
    .array(z.string())
    .optional()
    .describe("List of domain names associated with the Container."),
  publicId: z.string().optional().describe("Container Public ID."),
  tagIds: z
    .array(z.string())
    .optional()
    .describe("All Tag IDs that refer to this Container."),
  features: ContainerFeaturesSchema.optional().describe(
    "Read-only Container feature set.",
  ),
  notes: z.string().optional().describe("Container Notes."),
  usageContext: z
    .array(
      z.enum([
        "web",
        "android",
        "ios",
        "server",
        "amp",
        "iosSdk5",
        "androidSdk5",
        "usageContextUnspecified",
      ]),
    )
    .optional()
    .describe(
      "List of Usage Contexts for the Container. Valid values include: web, android, or ios.",
    ),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Container as computed at storage time.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  taggingServerUrls: z
    .array(z.string())
    .optional()
    .describe("List of server-side container URLs for the Container."),
};
