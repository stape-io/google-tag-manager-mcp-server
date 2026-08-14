import { z } from "zod";
import { ConditionSchema } from "./ConditionSchema.js";

/**
 * Zone resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.zones#Zone
 */
const ChildContainerSchema = z.object({
  publicId: z.string().describe("The child container's public id."),
  nickname: z
    .string()
    .optional()
    .describe("The zone's nickname for the child container."),
});

const BoundarySchema = z.object({
  condition: z
    .array(ConditionSchema)
    .optional()
    .describe("The conditions that, when conjoined, make up the boundary."),
  customEvaluationTriggerId: z
    .array(z.string())
    .optional()
    .describe(
      "Custom evaluation trigger IDs. A zone will evaluate its boundary conditions when any of the listed triggers are true.",
    ),
});

const TypeRestrictionSchema = z.object({
  enable: z
    .boolean()
    .optional()
    .describe("True if type restrictions have been enabled for this Zone."),
  whitelistedTypeId: z
    .array(z.string())
    .optional()
    .describe(
      "List of type public ids that have been whitelisted for use in this Zone.",
    ),
});

// Clean schema for merged tools (writable fields only)
export const ZoneSchema = z.object({
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  zoneId: z
    .string()
    .optional()
    .describe("The Zone ID uniquely identifies the GTM Zone."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Zone as computed at storage time. This value is recomputed whenever the zone is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  name: z.string().optional().describe("Zone display name."),
  type: z.string().optional().describe("Zone type."),
  childContainer: z
    .array(ChildContainerSchema)
    .optional()
    .describe("Child containers for the zone."),
  notes: z.string().optional().describe("Zone notes."),
  boundary: BoundarySchema.optional().describe("This Zone's boundary."),
  typeRestriction: TypeRestrictionSchema.optional().describe(
    "This Zone's type restrictions.",
  ),
});
