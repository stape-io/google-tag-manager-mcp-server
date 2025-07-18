import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

export const CaseConversionTypeEnum = z.enum([
  "none",
  "lowercase",
  "uppercase",
]);

export const FormatValueSchema = z.object({
  caseConversionType: CaseConversionTypeEnum.optional().describe(
    "Option to convert a string-type variable value to either lowercase or uppercase.",
  ),
  convertNullToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is null.",
  ),
  convertUndefinedToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is undefined.",
  ),
  convertTrueToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is true.",
  ),
  convertFalseToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is false.",
  ),
});

export const VariableSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  variableId: z
    .string()
    .optional()
    .describe("The Variable ID uniquely identifies the GTM Variable."),
  name: z.string().optional().describe("Variable display name."),
  type: z.string().optional().describe("GTM Variable Type."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this variable in the container."),
  scheduleStartMs: z
    .string()
    .optional()
    .describe("The start timestamp in milliseconds to schedule a variable."),
  scheduleEndMs: z
    .string()
    .optional()
    .describe("The end timestamp in milliseconds to schedule a variable."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The variable's parameters."),
  enablingTriggerId: z
    .array(z.string())
    .optional()
    .describe(
      "For mobile containers only: A list of trigger IDs for enabling conditional variables; the variable is enabled if one of the enabling triggers is true while all the disabling triggers are false. Treated as an unordered set.",
    ),
  disablingTriggerId: z
    .array(z.string())
    .optional()
    .describe(
      "For mobile containers only: A list of trigger IDs for disabling conditional variables; the variable is enabled if one of the enabling trigger is true while all the disabling trigger are false. Treated as an unordered set.",
    ),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Variable as computed at storage time. This value is recomputed whenever the variable is modified.",
    ),
  parentFolderId: z.string().optional().describe("Parent folder id."),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  formatValue: FormatValueSchema.optional().describe(
    "Option to convert a variable value to other value.",
  ),
};
