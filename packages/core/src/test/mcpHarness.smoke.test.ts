import { describe, expect, it } from "vitest";
import { createHarness } from "./mcpHarness.js";

describe("createHarness", () => {
  it("registers real tools and lists them over the real protocol", async () => {
    const harness = await createHarness();
    try {
      const { tools } = await harness.client.listTools();
      expect(tools.length).toBeGreaterThan(0);
    } finally {
      await harness.close();
    }
  });
});
