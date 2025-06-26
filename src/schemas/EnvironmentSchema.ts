import { z } from "zod";

export const EnvironmentTypeEnum = z.enum([
  "user",
  "live",
  "latest",
  "workspace",
]);

export const EnvironmentSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  environmentId: z
    .string()
    .optional()
    .describe("GTM Environment ID uniquely identifies the GTM Environment."),
  type: EnvironmentTypeEnum.optional().describe(
    "The type of this environment.",
  ),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM environment as computed at storage time.",
    ),
  name: z
    .string()
    .optional()
    .describe(
      "The environment display name. Can be set or changed only on USER type environments.",
    ),
  description: z
    .string()
    .optional()
    .describe(
      "The environment description. Can be set or changed only on USER type environments.",
    ),
  enableDebug: z
    .boolean()
    .optional()
    .describe("Whether or not to enable debug by default for the environment."),
  url: z
    .string()
    .optional()
    .describe("Default preview page url for the environment."),
  authorizationCode: z
    .string()
    .optional()
    .describe("The environment authorization code."),
  authorizationTimestamp: z
    .string()
    .optional()
    .describe(
      "The last update time-stamp for the authorization code. Uses RFC 3339 format.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  containerVersionId: z
    .string()
    .optional()
    .describe("Represents a link to a container version."),
  workspaceId: z
    .string()
    .optional()
    .describe("Represents a link to a quick preview of a workspace."),
};
