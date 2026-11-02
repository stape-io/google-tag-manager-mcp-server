import { spawnSync } from "node:child_process";

// Root pretest builds once. Nested workspace pretests can trust those fixtures;
// --ignore-scripts remains the caller's explicit choice to provide them itself.
const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "run", "test", "--workspaces", "--if-present"],
  {
    stdio: "inherit",
    env: { ...process.env, GTM_TEST_FIXTURES_READY: "true" },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
