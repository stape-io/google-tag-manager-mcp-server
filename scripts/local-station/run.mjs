import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const calls = [];
const attempts = new Map();
const fake = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const url = new URL(request.url, "http://fake.invalid");
  calls.push({
    at: Date.now(),
    method: request.method,
    path: url.pathname,
    query: url.search,
  });
  response.setHeader("content-type", "application/json");
  const count = (attempts.get(url.pathname) ?? 0) + 1;
  attempts.set(url.pathname, count);
  if (url.pathname.endsWith("/rate") && count === 1) {
    response.writeHead(403);
    response.end(
      JSON.stringify({ error: { errors: [{ reason: "rateLimitExceeded" }] } }),
    );
    return;
  }
  if (url.pathname.endsWith("/daily") || url.pathname.endsWith("/denied")) {
    const daily = url.pathname.endsWith("/daily");
    response.writeHead(daily ? 429 : 403);
    response.end(
      JSON.stringify({
        error: {
          message: daily ? "Queries per day exhausted" : "Permission denied",
        },
      }),
    );
    return;
  }
  if (request.method === "DELETE" && url.pathname.endsWith("/uncertain")) {
    request.socket.destroy();
    return;
  }
  if (request.method === "GET" && url.pathname.endsWith("/tags")) {
    const second = url.searchParams.get("pageToken") === "second";
    response.end(
      JSON.stringify({
        tag: Array.from({ length: 20 }, (_, index) => ({
          name: String(index + (second ? 20 : 0)),
        })),
        ...(second ? {} : { nextPageToken: "second" }),
      }),
    );
  } else response.end("{}");
});
await new Promise((resolve) => fake.listen(0, "127.0.0.1", resolve));
// Reserve an available Worker port instead of assuming the developer's ports.
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const origin = "http://127.0.0.1:" + port;
const persistence = await mkdtemp(join(tmpdir(), "gtm-local-station-"));
const worker = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--local",
    "--persist-to",
    persistence,
    "--config",
    "scripts/local-station/wrangler.jsonc",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--var",
    "LOCAL_GOOGLE_ORIGIN:http://127.0.0.1:" + fake.address().port,
  ],
  {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
for (const stream of [worker.stdout, worker.stderr])
  stream.on("data", (chunk) => {
    output += chunk;
  });
let id = 0;
async function call(
  name,
  args,
  user = "user-1",
  expectedError = false,
  coordinatorDelay = 0,
) {
  const response = await fetch(origin + "/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "x-station-user": user,
      "x-station-coordinator-delay": String(coordinatorDelay),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  const raw = await response.text();
  assert.equal(response.status, 200, raw);
  const payload = JSON.parse(
    raw.startsWith("event:")
      ? raw
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5))
          .join("")
      : raw,
  );
  assert.ok(payload.result, JSON.stringify(payload));
  assert.equal(
    Boolean(payload.result.isError),
    expectedError,
    JSON.stringify(payload),
  );
  return payload.result;
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (worker.exitCode !== null) throw new Error("Wrangler exited early");
    try {
      ready = (await fetch(origin + "/health")).ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, "Wrangler did not become ready");
  const args = {
    action: "list",
    accountId: "1",
    containerId: "2",
    workspaceId: "3",
  };
  const first = await call("gtm_tag", args);
  assert.equal(JSON.parse(first.content[0].text).pagination.totalItems, 40);
  assert.equal(calls.length, 2, "first scan fetches two upstream pages");
  const second = await call("gtm_tag", { ...args, page: 2 });
  assert.equal(JSON.parse(second.content[0].text).data[0].name, "20");
  assert.equal(
    calls.length,
    2,
    "separate HTTP request reuses the Durable Object snapshot",
  );
  await call("gtm_tag", args, "user-2");
  assert.equal(
    calls.length,
    4,
    "a separate Google user has an isolated snapshot",
  );
  await call("gtm_workspace", { ...args, action: "sync" });
  await call("gtm_tag", args);
  assert.equal(
    calls.length,
    7,
    "mutation invalidates the snapshot across HTTP requests",
  );
  const concurrentStart = calls.length;
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      call(
        "gtm_tag",
        {
          ...args,
          action: "get",
          tagId: "parallel-" + index,
        },
        "parallel-user-" + index,
      ),
    ),
  );
  const concurrent = calls.slice(concurrentStart);
  assert.equal(concurrent.length, 6);
  // Real HTTP scheduling has a small delivery jitter. Exact reservations are
  // checked separately under fake time; this catches missing shared wiring.
  assert.ok(
    concurrent.at(-1).at - concurrent[0].at >= 380,
    "different Google users share the same project pacing",
  );
  const beforeSlowCoordinator = calls.length;
  await call(
    "gtm_tag",
    { ...args, action: "get", tagId: "slow-coordinator" },
    "user-1",
    false,
    200,
  );
  assert.equal(
    calls.length - beforeSlowCoordinator,
    1,
    "a 100ms permit interval works with 200ms coordinator delivery",
  );
  const rateStart = calls.length;
  await call("gtm_tag", { ...args, action: "get", tagId: "rate" });
  const rate = calls.slice(rateStart);
  assert.equal(
    rate.length,
    2,
    "temporary 403 retries exactly once before success",
  );
  assert.ok(rate[1].at - rate[0].at >= 1_000, "retry uses backoff");
  for (const tagId of ["daily", "denied", "uncertain"]) {
    const start = calls.length;
    await call(
      "gtm_tag",
      { ...args, action: tagId === "uncertain" ? "remove" : "get", tagId },
      "user-1",
      true,
    );
    assert.equal(calls.length - start, 1, tagId + " does not retry");
  }
  const beforeCancel = calls.length;
  const cancelled = await fetch(origin + "/station/cancellation");
  assert.equal((await cancelled.json()).cancelled, true);
  await delay(750);
  assert.equal(
    calls.length,
    beforeCancel,
    "cancelling a remote snapshot prevents queued Google work",
  );
  console.log(
    JSON.stringify(
      {
        station: "local Wrangler + real Durable Objects + fake Google HTTP",
        result: "passed",
        calls,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  worker.kill("SIGTERM");
  await new Promise((resolve) => {
    if (worker.exitCode !== null) resolve();
    else worker.once("exit", resolve);
  });
  await new Promise((resolve) => fake.close(resolve));
  await rm(persistence, { recursive: true, force: true });
}
