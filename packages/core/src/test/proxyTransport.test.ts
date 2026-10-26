import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("preserves HTTPS_PROXY for ordinary GTM calls and snapshot scans", async () => {
  const targets: string[] = [];
  const proxy = createServer();
  proxy.on("connect", (request, socket) => {
    targets.push(request.url ?? "");
    const body = JSON.stringify({ error: { message: "Proxy test denied" } });
    socket.end(
      "HTTP/1.1 403 Forbidden\r\nContent-Type: application/json\r\nContent-Length: " +
        Buffer.byteLength(body) +
        "\r\n\r\n" +
        body,
    );
  });
  await new Promise<void>((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", resolve);
  });
  const port = (proxy.address() as AddressInfo).port;
  const script = [
    "import { createGtmMcpServer, setLogSink } from " +
      JSON.stringify(new URL("../../dist/index.js", import.meta.url).href) +
      ";",
    "import { Client, InMemoryTransport } from '@modelcontextprotocol/client';",
    "setLogSink(() => {});",
    "globalThis.fetch = async () => Response.json({ tag: [] });",
    "const server = createGtmMcpServer({ auth: { getAccessToken: async () => 'proxy-test-token' } });",
    "const client = new Client({ name: 'proxy-test', version: '0' });",
    "const [a, b] = InMemoryTransport.createLinkedPair();",
    "await Promise.all([client.connect(a), server.connect(b)]);",
    "const results = [];",
    "for (const action of ['get', 'list']) results.push(await client.callTool({ name: 'gtm_tag', arguments: { action, accountId: '1', containerId: '2', workspaceId: '3', tagId: '4' } }));",
    "console.log(JSON.stringify(results.map(result => result.isError)));",
    "await client.close(); await server.close();",
  ].join("\n");
  try {
    const result = await promisify(execFile)(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        env: {
          ...process.env,
          HTTPS_PROXY: "http://127.0.0.1:" + port,
          NO_PROXY: "",
          no_proxy: "",
        },
        timeout: 10_000,
      },
    );
    expect(targets).toEqual([
      "tagmanager.googleapis.com:443",
      "tagmanager.googleapis.com:443",
    ]);
    expect(JSON.parse(result.stdout)).toEqual([true, true]);
  } finally {
    await new Promise<void>((resolve, reject) =>
      proxy.close((error) => (error ? reject(error) : resolve())),
    );
  }
}, 15_000);
