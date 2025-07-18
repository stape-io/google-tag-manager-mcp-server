import { z } from "zod";
import { ConditionSchema } from "./ConditionSchema";
import { ParameterSchema } from "./ParameterSchema";

export const TriggerSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  triggerId: z
    .string()
    .optional()
    .describe("The Trigger ID uniquely identifies the GTM Trigger."),
  name: z.string().optional().describe("Trigger display name."),
  type: z
    .string()
    .optional()
    .describe("Defines the data layer event that causes this trigger."),
  customEventFilter: z
    .array(ConditionSchema)
    .optional()
    .describe(
      "Used in the case of custom event, which is fired iff all Conditions are true.",
    ),
  filter: z
    .array(ConditionSchema)
    .optional()
    .describe("The trigger will only fire iff all Conditions are true."),
  autoEventFilter: z
    .array(ConditionSchema)
    .optional()
    .describe("Used in the case of auto event tracking."),
  waitForTags: ParameterSchema.optional().describe(
    "Whether or not to delay form submissions or link opening until all of the tags have fired. Only valid for Form Submission and Link Click triggers.",
  ),
  checkValidation: ParameterSchema.optional().describe(
    "Whether or not to only fire tags if the form submit or link click event is not cancelled by some other event handler. Only valid for Form Submission and Link Click triggers.",
  ),
  waitForTagsTimeout: ParameterSchema.optional().describe(
    "How long to wait (in ms) for tags to fire when 'waits_for_tags' above evaluates to true. Only valid for Form Submission and Link Click triggers.",
  ),
  uniqueTriggerId: ParameterSchema.optional().describe(
    "Globally unique id of the trigger that auto-generates this (a Form Submit, Link Click or Timer listener) if any. Only valid for Form Submit, Link Click and Timer triggers.",
  ),
  eventName: ParameterSchema.optional().describe(
    "Name of the GTM event that is fired. Only valid for Timer triggers.",
  ),
  interval: ParameterSchema.optional().describe(
    "Time between triggering recurring Timer Events (in ms). Only valid for Timer triggers.",
  ),
  limit: ParameterSchema.optional().describe(
    "Limit of the number of GTM events this Timer Trigger will fire. Only valid for Timer triggers.",
  ),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Trigger as computed at storage time. This value is recomputed whenever the trigger is modified.",
    ),
  parentFolderId: z.string().optional().describe("Parent folder id."),
  selector: ParameterSchema.optional().describe(
    "A click trigger CSS selector. Only valid for AMP Click trigger.",
  ),
  intervalSeconds: ParameterSchema.optional().describe(
    "Time between Timer Events to fire (in seconds). Only valid for AMP Timer trigger.",
  ),
  maxTimerLengthSeconds: ParameterSchema.optional().describe(
    "Max time to fire Timer Events (in seconds). Only valid for AMP Timer trigger.",
  ),
  verticalScrollPercentageList: ParameterSchema.optional().describe(
    "List of integer percentage values for scroll triggers. Fires when each percentage is reached when scrolled vertically. Only valid for AMP scroll triggers.",
  ),
  horizontalScrollPercentageList: ParameterSchema.optional().describe(
    "List of integer percentage values for scroll triggers. Fires when each percentage is reached when scrolled horizontally. Only valid for AMP scroll triggers.",
  ),
  visibilitySelector: ParameterSchema.optional().describe(
    "A visibility trigger CSS selector. Only valid for AMP Visibility trigger.",
  ),
  visiblePercentageMin: ParameterSchema.optional().describe(
    "A visibility trigger minimum percent visibility. Only valid for AMP Visibility trigger.",
  ),
  visiblePercentageMax: ParameterSchema.optional().describe(
    "A visibility trigger maximum percent visibility. Only valid for AMP Visibility trigger.",
  ),
  continuousTimeMinMilliseconds: ParameterSchema.optional().describe(
    "A visibility trigger minimum continuous visible time (ms). Only valid for AMP Visibility trigger.",
  ),
  totalTimeMinMilliseconds: ParameterSchema.optional().describe(
    "A visibility trigger minimum total visible time (ms). Only valid for AMP Visibility trigger.",
  ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this trigger in the container."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("Additional parameters for the trigger."),
};
