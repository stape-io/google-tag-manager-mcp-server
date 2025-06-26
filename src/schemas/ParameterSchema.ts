import { z } from "zod";

export const ParameterSchema = z.object({
  type: z.string().optional().describe("The type of the parameter."),
  key: z.string().optional().describe("Parameter key."),
  value: z
    .string()
    .optional()
    .describe(
      "Parameter value as a string. The actual value may depend on the parameter type.",
    ),
  list: z
    .array(z.any())
    .optional()
    .describe("List of parameter values (if the parameter is a list type)."),
  map: z
    .array(z.any())
    .optional()
    .describe("Array of key-value pairs for map parameters."),
  isWeakReference: z
    .boolean()
    .optional()
    .describe("Whether this is a weak reference parameter."),
});
