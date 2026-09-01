import { z } from "zod";

export const CombineConfigSchema = z.object({
  accountId: z
    .string()
    .describe("The GTM Account ID containing the containers to combine."),
  fromContainerId: z
    .string()
    .describe("The ID of the source container whose data will be merged."),
  toContainerId: z
    .string()
    .describe("The ID of the target container to merge data into."),
  allowUserPermissionFeatureUpdate: z
    .boolean()
    .optional()
    .describe(
      "Set to true to allow user permissions to be updated during the combine operation.",
    ),
  settingSource: z
    .string()
    .optional()
    .describe(
      "Specifies the source of configuration settings after the combine.",
    ),
});
