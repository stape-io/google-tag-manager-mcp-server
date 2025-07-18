import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

/**
 * Tag resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.tags#Tag
 */
const ConsentSettingSchema = z.object({
  consentStatus: z
    .enum(["notSet", "notNeeded", "needed"])
    .optional()
    .describe(
      "The tag's consent status. If set to NEEDED, the runtime will check that the consent types specified by the consentType field have been granted.",
    ),
  consentType: ParameterSchema.optional().describe(
    "The type of consents to check for during tag firing if in the consent NEEDED state. This parameter must be of type LIST where each list item is of type STRING.",
  ),
});

const SetupTagSchema = z.object({
  tagName: z.string().optional().describe("The name of the setup tag."),
  stopOnSetupFailure: z
    .boolean()
    .optional()
    .describe(
      "If true, fire the main tag if and only if the setup tag fires successfully. If false, fire the main tag regardless of setup tag firing status.",
    ),
});

const TeardownTagSchema = z.object({
  tagName: z.string().optional().describe("The name of the teardown tag."),
  stopTeardownOnFailure: z
    .boolean()
    .optional()
    .describe(
      "If true, fire the teardown tag if and only if the main tag fires successfully. If false, fire the teardown tag regardless of main tag firing status.",
    ),
});

const TagFiringOptionEnum = z.enum([
  "tagFiringOptionUnspecified",
  "unlimited",
  "oncePerEvent",
  "oncePerLoad",
]);

export const TagSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  tagId: z
    .string()
    .optional()
    .describe("The Tag ID uniquely identifies the GTM Tag."),
  name: z.string().optional().describe("Tag display name."),
  type: z.string().optional().describe("GTM Tag Type."),
  liveOnly: z
    .boolean()
    .optional()
    .describe(
      "If set to true, this tag will only fire in the live environment (e.g. not in preview or debug mode).",
    ),
  priority: ParameterSchema.optional().describe(
    "User defined numeric priority of the tag. Tags are fired asynchronously in order of priority. Tags with higher numeric value fire first. A tag's priority can be a positive or negative value. The default value is 0.",
  ),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this tag in the container."),
  scheduleStartMs: z
    .string()
    .optional()
    .describe("The start timestamp in milliseconds to schedule a tag."),
  scheduleEndMs: z
    .string()
    .optional()
    .describe("The end timestamp in milliseconds to schedule a tag."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The tag's parameters."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Tag as computed at storage time. This value is recomputed whenever the tag is modified.",
    ),
  firingTriggerId: z
    .array(z.string())
    .optional()
    .describe(
      "Firing trigger IDs. A tag will fire when any of the listed triggers are true and all of its blockingTriggerIds (if any specified) are false.",
    ),
  blockingTriggerId: z
    .array(z.string())
    .optional()
    .describe(
      "Blocking trigger IDs. If any of the listed triggers evaluate to true, the tag will not fire.",
    ),
  setupTag: z
    .array(SetupTagSchema)
    .optional()
    .describe("The list of setup tags. Currently only one is allowed."),
  teardownTag: z
    .array(TeardownTagSchema)
    .optional()
    .describe("The list of teardown tags. Currently only one is allowed."),
  parentFolderId: z.string().optional().describe("Parent folder id."),
  tagFiringOption: TagFiringOptionEnum.optional().describe(
    "Option to fire this tag.",
  ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  paused: z
    .boolean()
    .optional()
    .describe(
      "Indicates whether the tag is paused, which prevents the tag from firing.",
    ),
  monitoringMetadata: z
    .object(ParameterSchema.shape)
    .optional()
    .describe(
      "A map of key-value pairs of tag metadata to be included in the event data for tag monitoring.",
    ),
  monitoringMetadataTagNameKey: z
    .string()
    .optional()
    .describe(
      "If non-empty, then the tag display name will be included in the monitoring metadata map using the key specified.",
    ),
  consentSettings: ConsentSettingSchema.optional().describe(
    "Consent settings of a tag.",
  ),
};
