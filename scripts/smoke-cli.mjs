import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const CLI = "packages/cli/dist/index.js";
const TIMEOUT_MS = 30_000;
// The 2025-era revision the legacy `initialize` handshake claims AND the version
// the server must echo back as negotiated. Bumped in lockstep with whatever the
// server actually negotiates on that path.
const LEGACY_PROTOCOL_VERSION = "2024-11-05";
// The modern revision the CLI must advertise on `server/discover`. This is the
// whole point of serving via serveStdio(): a bare McpServer + StdioServerTransport
// answers the 2025 era only, whatever SDK version it is built against.
const MODERN_PROTOCOL_VERSION = "2026-07-28";

// The per-request `_meta` envelope that marks a frame as modern-era. A client
// that negotiates 2026-07-28 attaches this to every outgoing request.
const MODERN_META = {
  "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientInfo": { name: "smoke", version: "0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

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

// No tool is called in any of these runs, so the token never reaches Google.
function serve(requests) {
  return run(
    { ...process.env, GOOGLE_ACCESS_TOKEN: "smoke-test-token" },
    requests.map((request) => `${JSON.stringify(request)}\n`).join(""),
  );
}

function parseMessages({ code, stdout, stderr }, label) {
  assert.equal(code, 0, `[${label}] CLI exited with ${code}\n${stderr}`);
  try {
    return stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  } catch (error) {
    // A log line on stdout corrupts the JSON-RPC stream - that is the failure.
    assert.fail(`[${label}] stdout is not pure JSON-RPC:\n${stdout}\n${error}`);
  }
}

function assertToolset(tools, label) {
  assert.ok(
    tools.length >= 20,
    `[${label}] expected at least 20 tools, got ${tools.length}`,
  );
  for (const name of ["gtm_account", "gtm_tag", "gtm_workspace"]) {
    assert.ok(
      tools.some((tool) => tool.name === name),
      `[${label}] missing tool ${name}`,
    );
  }
  return tools;
}

// --- 1. Modern era: protocol revision 2026-07-28 -----------------------------
// The opening is `server/discover`, not `initialize`; 2026-era connections never
// run an `initialize` handshake at all.
const modern = parseMessages(
  await serve([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: { _meta: MODERN_META },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: { _meta: MODERN_META } },
  ]),
  "modern",
);

const discovered = modern.find((message) => message.id === 1)?.result;
assert.ok(
  discovered,
  `server/discover was not answered - the CLI is not serving the modern era:\n${JSON.stringify(modern)}`,
);
// The assertion that actually proves the era, read off the SERVER's response
// rather than what the client claimed on the way in.
assert.ok(
  discovered.supportedVersions?.includes(MODERN_PROTOCOL_VERSION),
  `server/discover advertised ${JSON.stringify(discovered.supportedVersions)}, expected it to include ${MODERN_PROTOCOL_VERSION}`,
);
assert.equal(
  discovered._meta?.["io.modelcontextprotocol/serverInfo"]?.name,
  "google-tag-manager-mcp-server",
);

const modernTools = assertToolset(
  modern.find((message) => message.id === 2)?.result?.tools ?? [],
  "modern",
);

// --- 2. Legacy era: the 2025 `initialize` handshake still works ---------------
// serveStdio() serves both eras; a 2025-only client must keep working unchanged.
const legacy = parseMessages(
  await serve([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LEGACY_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "smoke", version: "0" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
  ]),
  "legacy",
);

const initialized = legacy.find((message) => message.id === 1)?.result;
assert.equal(initialized?.serverInfo?.name, "google-tag-manager-mcp-server");
// Negotiated version read off the server's response, not the request we sent.
assert.equal(
  initialized?.protocolVersion,
  LEGACY_PROTOCOL_VERSION,
  `legacy initialize negotiated ${initialized?.protocolVersion}, expected ${LEGACY_PROTOCOL_VERSION}`,
);

assertToolset(
  legacy.find((message) => message.id === 2)?.result?.tools ?? [],
  "legacy",
);

// --- 3. No credentials: fail fast at startup ---------------------------------
const unconfigured = await run(withoutGoogleCredentials(), "");
assert.equal(unconfigured.code, 1, "expected exit code 1 without credentials");
assert.match(unconfigured.stderr, /GOOGLE_SERVICE_ACCOUNT_KEY/);

console.log(
  `smoke-cli: ok (${modernTools.length} tools; negotiated ${MODERN_PROTOCOL_VERSION} and ${LEGACY_PROTOCOL_VERSION})`,
);
