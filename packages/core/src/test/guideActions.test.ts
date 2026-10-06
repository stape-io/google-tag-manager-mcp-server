import { describe, expect, it } from "vitest";
import { useGoogleApiStub } from "./googleApiStub.js";
import { GUIDES } from "../tools/guideActions.js";

const google = useGoogleApiStub();

describe("gtm_guide", () => {
  it.each(Object.keys(GUIDES))("returns the '%s' guide", async (topic) => {
    const { isError, text } = await google.callTool("gtm_guide", { topic });

    expect(isError).toBeFalsy();
    expect(text).toBe(GUIDES[topic as keyof typeof GUIDES]);
    expect(text.startsWith("# ")).toBe(true);
    expect(google.calls).toHaveLength(0);
  });

  it("rejects an unknown topic", async () => {
    const { isError } = await google.callTool("gtm_guide", { topic: "nope" });
    expect(isError).toBe(true);
  });
});
