import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const CLI = "packages/cli/dist/index.js";
const TIMEOUT_MS = 30_000;

function run(env, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [CLI], {
      env: { ...env, NO_COLOR: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${CLI} did not exit within ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    // "close", not "exit": only then is stdout drained.
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(stdin);
  });
}

function withoutGoogleCredentials() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GOOGLE_")),
  );
}

const requests = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    },
  },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
];

// No tool is called, so the token never reaches Google.
const served = await run(
  { ...process.env, GOOGLE_ACCESS_TOKEN: "smoke-test-token" },
  requests.map((request) => `${JSON.stringify(request)}\n`).join(""),
);

assert.equal(served.code, 0, `CLI exited with ${served.code}\n${served.stderr}`);

const lines = served.stdout.trim().split("\n");
let messages;
try {
  messages = lines.map((line) => JSON.parse(line));
} catch (error) {
  // A log line on stdout corrupts the JSON-RPC stream - that is the failure.
  assert.fail(`stdout is not pure JSON-RPC:\n${served.stdout}\n${error}`);
}

const initialized = messages.find((message) => message.id === 1);
assert.equal(
  initialized?.result?.serverInfo?.name,
  "google-tag-manager-mcp-server",
);

const tools = messages.find((message) => message.id === 2)?.result?.tools ?? [];
assert.ok(
  tools.length >= 18,
  `expected at least 18 tools, got ${tools.length}`,
);
for (const name of ["gtm_account", "gtm_tag", "gtm_workspace"]) {
  assert.ok(
    tools.some((tool) => tool.name === name),
    `missing tool ${name}`,
  );
}

const unconfigured = await run(withoutGoogleCredentials(), "");
assert.equal(unconfigured.code, 1, "expected exit code 1 without credentials");
assert.match(unconfigured.stderr, /GOOGLE_SERVICE_ACCOUNT_KEY/);

console.log(`smoke-cli: ok (${tools.length} tools)`);
