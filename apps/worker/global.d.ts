/* eslint-disable */

declare namespace Cloudflare {
  interface Env {
    GTM_READ_CACHE?: DurableObjectNamespace;
    GTM_USAGE?: AnalyticsEngineDataset;
    GTM_SNAPSHOT_CACHE_ENABLED?: string;
    GTM_REQUEST_SCHEDULER_ENABLED?: string;
    GTM_QUOTA_PROJECT_ID?: string;
    GTM_REQUEST_INTERVAL_MS?: string;
    GTM_REQUEST_MAX_PENDING?: string;
    GTM_REQUEST_COORDINATOR?: DurableObjectNamespace;
    OAUTH_KV: KVNamespace;
    GOOGLE_CLIENT_ID: "";
    GOOGLE_CLIENT_SECRET: "";
    COOKIE_ENCRYPTION_KEY: "";
    HOSTED_DOMAIN: "";
    WORKER_HOST: "";
    /** "true" only on gtm-mcp.stape.ai (see src/utils/hostNotice.ts). */
    SHOW_HOST_NOTICE?: string;
    MCP_OBJECT: DurableObjectNamespace<
      import("./src/index").GoogleTagManagerMCPServer
    >;
  }
}
interface Env extends Cloudflare.Env {}
