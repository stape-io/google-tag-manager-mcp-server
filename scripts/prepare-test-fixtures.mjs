import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.GTM_TEST_FIXTURES_READY !== "true") {
  for (const workspace of [
    "google-tag-manager-mcp-core",
    "google-tag-manager-mcp-server",
  ]) {
    const result = spawnSync(
      process.execPath,
      [process.env.npm_execpath, "run", "build", "--workspace", workspace],
      { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
