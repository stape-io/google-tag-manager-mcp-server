import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Transform OAuthProvider so tests can mock its `cloudflare:workers` import.
    server: { deps: { inline: ["@cloudflare/workers-oauth-provider"] } },
  },
});
