import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it } from "vitest";

type Vars = {
  SHOW_HOST_NOTICE?: string;
  GTM_SNAPSHOT_CACHE_ENABLED?: string;
  GTM_REQUEST_SCHEDULER_ENABLED?: string;
  GTM_QUOTA_PROJECT_ID?: string;
  GTM_REQUEST_INTERVAL_MS?: string;
};
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
  expect(config.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("true");
  expect(config.env.dev.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("true");
  expect(config.env.io.vars?.GTM_SNAPSHOT_CACHE_ENABLED).toBe("true");
});

// Both production hosts spend the same Google project quota from separate
// coordinators, so each needs its own static share of it.
it("schedules both production hosts against the shared quota project", () => {
  for (const vars of [config.vars, config.env.io.vars]) {
    expect(vars?.GTM_REQUEST_SCHEDULER_ENABLED).toBe("true");
    expect(vars?.GTM_QUOTA_PROJECT_ID).toBe("gtm-mcp");
  }
  expect(config.vars?.GTM_REQUEST_INTERVAL_MS).toBe("2000");
  expect(config.env.io.vars?.GTM_REQUEST_INTERVAL_MS).toBe("3500");
});

// The project allows 60 requests a minute; keep the shares at 80% of it.
it("keeps the combined production rate under the project quota", () => {
  const perMinute = [config.vars, config.env.io.vars].reduce(
    (sum, vars) => sum + 60_000 / Number(vars?.GTM_REQUEST_INTERVAL_MS),
    0,
  );
  expect(perMinute).toBeLessThanOrEqual(48);
});
