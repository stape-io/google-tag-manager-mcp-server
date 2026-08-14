import { z } from "zod";

export const MoveTagIdConfigSchema = z.object({
  accountId: z
    .string()
    .describe("The GTM Account ID containing the container."),
  containerId: z
    .string()
    .describe("The GTM Container ID to move the tag from."),
  tagId: z.string().describe("The ID of the tag to move."),
  tagName: z
    .string()
    .optional()
    .describe("The name for the newly created tag."),
  allowUserPermissionFeatureUpdate: z
    .boolean()
    .optional()
    .describe(
      "Set to true to allow user permissions to be updated during the move.",
    ),
  copySettings: z
    .boolean()
    .optional()
    .describe("Whether to copy tag settings to the new tag."),
  copyTermsOfService: z
    .boolean()
    .optional()
    .describe(
      "Set to true to accept all terms of service agreements for the new tag.",
    ),
  copyUsers: z
    .boolean()
    .optional()
    .describe("Whether to copy users from this tag to the new tag."),
});
