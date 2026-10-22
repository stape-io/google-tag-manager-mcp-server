import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

type Vars = { SHOW_HOST_NOTICE?: string; GTM_SNAPSHOT_CACHE_ENABLED?: string };
type WranglerConfig = { vars?: Vars; env: Record<string, { vars?: Vars }> };

// TypeScript's JSON reader accepts the comments wrangler.jsonc carries.
const { config } = ts.parseConfigFileTextToJson(
  "wrangler.jsonc",
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8"),
) as { config: WranglerConfig };

// Only the default env deploys the old host. A named env that turned the
// notice on would announce the shutdown, and later stop every tool, on a
// host that isn't shutting down.
it("shows the host notice from the default env only", () => {
  expect(config.vars?.SHOW_HOST_NOTICE).toBe("true");

  for (const [name, env] of Object.entries(config.env)) {
    expect(env.vars?.SHOW_HOST_NOTICE, name).not.toBe("true");
  }
});

it("keeps the snapshot rollout flags alongside the host notice flags", () => {
  expect(config.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("false");
  expect(config.env.dev.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("true");
  expect(config.env.io.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("false");
});
