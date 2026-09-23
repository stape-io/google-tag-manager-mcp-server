import { PACKAGE_VERSION } from "../version";

/** Shared by both routes so `/sse` and `/mcp` can never advertise different identities. */
export const SERVER_INFO = {
  name: "google-tag-manager-mcp-server",
  title: "Google Tag Manager",
  version: PACKAGE_VERSION,
  websiteUrl: "https://github.com/stape-io/google-tag-manager-mcp-server",
} as const;
