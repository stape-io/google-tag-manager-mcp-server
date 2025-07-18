import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

/**
 * Represents a GTM Condition (predicate), as per GTM API documentation.
 * - type: The type of operator for this condition (ConditionType enum).
 * - parameter: A list of named parameters (key/value), depending on the condition's type.
 *   - For binary operators, include parameters named arg0 and arg1 for specifying the left and right operands.
 *   - For case-insensitive Regex matching, include a boolean parameter named ignore_case set to true.
 *   - To negate an operator, include a boolean parameter named negate set to true.
 */
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
