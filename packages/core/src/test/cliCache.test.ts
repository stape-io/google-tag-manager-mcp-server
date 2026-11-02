import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { expect, it } from "vitest";

it.each([undefined, "true", "false"])(
  "supports the CLI cache setting %s",
  async (setting) => {
    const preload = [
      "let scans = 0;",
      "globalThis.window = { fetch: async () => {",
      "scans++; return Response.json({ tag: [0, 1].map(index => ({ name: 'scan-' + scans + '-' + index })) });",
      "} };",
    ].join("\n");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        "data:text/javascript," + encodeURIComponent(preload),
        fileURLToPath(new URL("../../../cli/dist/index.js", import.meta.url)),
      ],
      env: {
        GOOGLE_ACCESS_TOKEN: "cli-test-token",
        ...(setting === undefined
          ? {}
          : { GTM_SNAPSHOT_CACHE_ENABLED: setting }),
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "cli-cache-test", version: "0" });
    try {
      await client.connect(transport);
      const names: string[] = [];
      for (const [page, fresh] of [
        [1, false],
        [2, false],
        [1, true],
      ] as const) {
        const result = await client.callTool({
          name: "gtm_tag",
          arguments: {
            action: "list",
            accountId: "1",
            containerId: "2",
            workspaceId: "3",
            page,
            itemsPerPage: 1,
            fresh,
          },
        });
        expect(result.isError).not.toBe(true);
        const text = (result.content as { text: string }[])[0].text;
        names.push(JSON.parse(text).data[0].name);
      }
      expect(names).toEqual(
        setting === "false"
          ? ["scan-1-0", "scan-2-1", "scan-3-0"]
          : ["scan-1-0", "scan-1-1", "scan-2-0"],
      );
    } finally {
      await client.close();
    }
  },
);
