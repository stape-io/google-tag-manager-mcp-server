import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

export const TransformationSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  transformationId: z
    .string()
    .optional()
    .describe(
      "The Transformation ID uniquely identifies the GTM transformation.",
    ),
  name: z.string().optional().describe("Transformation display name."),
  type: z.string().optional().describe("Transformation type."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The transformation's parameters."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Transformation as computed at storage time. This value is recomputed whenever the transformation is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  parentFolderId: z.string().optional().describe("Parent folder id."),
  notes: z
    .string()
    .optional()
    .describe(
      "User notes on how to apply this transformation in the container.",
    ),
};
