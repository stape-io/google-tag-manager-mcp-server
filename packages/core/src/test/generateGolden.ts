import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import { createHarness } from "./mcpHarness.js";
import { normalizeToolsList } from "./normalizeTools.js";

/**
 * Regenerates the committed golden `tools/list` snapshot consumed by
 * toolRegistry.test.ts. Run via `npm run test:golden:update` (packages/core),
 * which points vitest at this file specifically via vitest.golden.config.ts.
 * Not part of the normal suite - its filename doesn't end in `.test.ts`, so
 * the default vitest `include` glob (and therefore `npm test`) never picks
 * it up or silently rewrites the fixture. It's structured as a single `it()`
 * only so vitest (already a devDependency, and the only TS-aware runner in
 * this package) has something to execute and report a real exit code for.
 */
it("regenerates the golden tools/list snapshot", async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const goldenPath = join(__dirname, "__golden__", "tools.json");

  const harness = await createHarness();
  try {
    const { tools } = await harness.client.listTools();
    writeFileSync(goldenPath, normalizeToolsList(tools));
  } finally {
    await harness.close();
  }
});
