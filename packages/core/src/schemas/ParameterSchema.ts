import { z } from "zod";

// Helper function to check the maximum depth of a parameter object
function getParameterDepth(
  param: ParameterSchemaModel | undefined,
  currentDepth = 1,
): number {
  if (!param || typeof param !== "object") {
    return currentDepth;
  }
  let maxDepth = currentDepth;
  if (Array.isArray(param.list)) {
    for (const item of param.list) {
      maxDepth = Math.max(maxDepth, getParameterDepth(item, currentDepth + 1));
    }
  }
  if (Array.isArray(param.map)) {
    for (const item of param.map) {
      maxDepth = Math.max(maxDepth, getParameterDepth(item, currentDepth + 1));
    }
  }
  return maxDepth;
}

export interface ParameterSchemaModel {
  type?: string;
  key?: string;
  value?: string;
  list?: ParameterSchemaModel[];
  map?: ParameterSchemaModel[];
  isWeakReference?: boolean;
}

const BaseParameterSchema = z.lazy(() =>
  z.object({
    type: z.string().optional().describe("The type of the parameter."),
    key: z.string().optional().describe("Parameter key."),
    value: z
      .string()
      .optional()
      .describe(
        "Parameter value as a string. The actual value may depend on the parameter type.",
      ),
    list: z
      .array(BaseParameterSchema)
      .optional()
      .describe("List of parameter values (if the parameter is a list type)."),
    map: z
      .array(BaseParameterSchema)
      .optional()
      .describe("Array of key-value pairs for map parameters."),
    isWeakReference: z
      .boolean()
      .optional()
      .describe("Whether this is a weak reference parameter."),
  }),
) as unknown as z.ZodType<ParameterSchemaModel>;

export const ParameterSchema = BaseParameterSchema.superRefine((val, ctx) => {
  const depth = getParameterDepth(val);
  if (depth > 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Parameter nesting exceeds maximum allowed depth of 3 (found depth: ${depth})`,
    });
  }
});
