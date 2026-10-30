import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const generator = fileURLToPath(
  new URL("./generate-version.mjs", import.meta.url),
);
test("version checks reject stale source without repairing it; generation repairs it", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gtm-version-check-"));
  try {
    await mkdir(path.join(dir, "src"));
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "fixture", version: "3.0.1" }),
    );
    const target = path.join(dir, "src/version.ts");
    await writeFile(target, "stale version\n");
    const check = spawnSync(process.execPath, [generator, "--check"], {
      cwd: dir,
      encoding: "utf8",
    });
    assert.equal(check.status, 1);
    assert.match(check.stderr, /Generated version is stale/);
    assert.equal(await readFile(target, "utf8"), "stale version\n");
    assert.equal(
      spawnSync(process.execPath, [generator], { cwd: dir }).status,
      0,
    );
    assert.match(await readFile(target, "utf8"), /PACKAGE_VERSION = "3.0.1"/);
    assert.equal(
      spawnSync(process.execPath, [generator, "--check"], { cwd: dir }).status,
      0,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
