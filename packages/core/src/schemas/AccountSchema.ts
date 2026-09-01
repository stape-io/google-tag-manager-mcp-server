import { z } from "zod";

const FeaturesSchema = z.object({
  supportUserPermissions: z
    .boolean()
    .optional()
    .describe("Whether this Account supports user permissions managed by GTM."),
  supportMultipleContainers: z
    .boolean()
    .optional()
    .describe("Whether this Account supports multiple Containers."),
});

export const AccountSchema = z.object({
  accountId: z.string().describe("GTM Account ID."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Account as computed at storage time.",
    ),
  name: z.string().optional().describe("Account display name."),
  shareData: z
    .boolean()
    .optional()
    .describe(
      "Whether the account shares data anonymously with Google and others.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  features: FeaturesSchema.optional().describe(
    "Read-only Account feature set.",
  ),
});
