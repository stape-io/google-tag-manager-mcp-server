import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema.js";

export const CaseConversionTypeEnum = z.enum([
  "none",
  "lowercase",
  "uppercase",
]);

export const DecimalSeparatorTypeEnum = z.enum([
  "decimalSeparatorTypeUnspecified",
  "period",
  "comma",
  "automatic",
]);

const VariableFormatValueSchema = z.object({
  caseConversionType: CaseConversionTypeEnum.optional().describe(
    "The option to convert a string-type variable value to either lowercase or uppercase.",
  ),
  convertToNumber: DecimalSeparatorTypeEnum.optional().describe(
    "The option to convert a variable value to a number.",
  ),
  convertNullToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is null.",
  ),
  convertUndefinedToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is undefined.",
  ),
  convertToBoolean: z
    .boolean()
    .optional()
    .describe("The option to convert a variable value to a boolean."),
  convertTrueToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is true.",
  ),
  convertFalseToValue: ParameterSchema.optional().describe(
    "The value to convert if a variable value is false.",
  ),
});

export const VariableSchema = z.object({
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  variableId: z
    .string()
    .optional()
    .describe("The Variable ID uniquely identifies the GTM Variable."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Variable as computed at storage time. This value is recomputed whenever the variable is modified.",
    ),
  name: z.string().optional().describe("Variable display name."),
  type: z.string().optional().describe("Variable type."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The variable's parameters."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this variable in the container."),
  formatValue: VariableFormatValueSchema.optional().describe(
    "Options to convert a variable value to another value.",
  ),
  parentFolderId: z.string().optional().describe("Parent folder id."),
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
      "For mobile containers only: A list of trigger IDs for disabling conditional variables; the variable is enabled if one of the enabling triggers is true while all the disabling triggers are false. Treated as an unordered set.",
    ),
  scheduleStartMs: z
    .string()
    .optional()
    .describe("The start timestamp in milliseconds to schedule a variable."),
  scheduleEndMs: z
    .string()
    .optional()
    .describe("The end timestamp in milliseconds to schedule a variable."),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
});
