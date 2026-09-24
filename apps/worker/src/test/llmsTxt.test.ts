import { expect, it } from "vitest";
import { apisHandler } from "../utils/apisHandler";

it("serves /llms.txt as plain text", async () => {
  const response = await apisHandler.request("/llms.txt");

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/^text\/plain/);

  const body = await response.text();
  // llms.txt format: an H1 title followed by a blockquote summary.
  expect(body).toMatch(/^# .+\n\n> .+/);
  expect(body).toContain("https://gtm-mcp.stape.ai/mcp");
});
