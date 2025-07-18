import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

/**
 * GtagConfig resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.gtag_config#GtagConfig
 */
export const GtagConfigSchemaFields = {
  accountId: z.string().describe("Google tag account ID."),
  containerId: z.string().describe("Google tag container ID."),
  workspaceId: z
    .string()
    .describe(
      "Google tag workspace ID. Only used by GTM containers. Set to 0 otherwise.",
    ),
  gtagConfigId: z
    .string()
    .optional()
    .describe("The ID uniquely identifies the Google tag config."),
  type: z.string().optional().describe("Google tag config type."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The Google tag config's parameters."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the Google tag config as computed at storage time. This value is recomputed whenever the config is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
};
