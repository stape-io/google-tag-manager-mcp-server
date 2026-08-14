import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema.js";

export const ConditionSchema = z.object({
  type: z
    .string()
    .describe("The type of operator for this condition (ConditionType enum)."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe(
      "A list of named parameters (key/value), depending on the condition's type.",
    ),
});
