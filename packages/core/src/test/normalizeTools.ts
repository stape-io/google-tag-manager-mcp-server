import { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Recursively sorts object keys so JSON.stringify output is stable regardless of
 * property insertion order. Arrays are recursed into but not reordered.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortKeysDeep(source[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Deterministically normalizes a `tools/list` result for golden-file comparison:
 * tools sorted by name, all object keys sorted recursively, 2-space-indented JSON.
 * Shared by the golden snapshot test and the one-off fixture generation script so
 * both use identical normalization logic.
 */
export function normalizeToolsList(tools: Tool[]): string {
  const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(sortKeysDeep(sortedTools), null, 2) + "\n";
}
