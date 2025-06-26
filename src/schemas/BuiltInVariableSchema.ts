import { z } from "zod";

export const BuiltInVariableSchemaFields = {
  type: z.string().optional().describe("Type of built-in variable."),
  name: z
    .string()
    .optional()
    .describe("Display name for the built-in variable."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this variable in tagging scenarios."),
};
