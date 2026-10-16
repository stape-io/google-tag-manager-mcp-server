/* eslint-disable */

declare namespace Cloudflare {
  interface Env {
    GTM_READ_CACHE?: DurableObjectNamespace;
    GTM_USAGE?: AnalyticsEngineDataset;
    GTM_SNAPSHOT_CACHE_ENABLED?: string;
    OAUTH_KV: KVNamespace;
    GOOGLE_CLIENT_ID: "";
    GOOGLE_CLIENT_SECRET: "";
    COOKIE_ENCRYPTION_KEY: "";
    HOSTED_DOMAIN: "";
    WORKER_HOST: "";
    MCP_OBJECT: DurableObjectNamespace<
      import("./src/index").GoogleTagManagerMCPServer
    >;
  }
}
interface Env extends Cloudflare.Env {}
