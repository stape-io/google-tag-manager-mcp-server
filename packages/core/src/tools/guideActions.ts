import { McpServer, CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { log } from "../utils/index.js";

// Served as a tool rather than MCP prompts/resources: every client can call a
// tool, while prompt/resource support is uneven across clients.
export const GUIDES = {
  safeEditing: `# Safe editing workflow

1. Never edit the live container directly. Work in a workspace: \`gtm_workspace\` 'list', then 'create' a dedicated one (free containers allow 3 workspaces at a time, including the Default Workspace).
2. Read before you write: 'get' the entity first. Every 'update' is a FULL REPLACE — any field you omit is deleted. Send back the complete object with your change applied, plus the \`fingerprint\` returned by 'get'. A stale fingerprint fails loudly; re-'get' and retry instead of forcing it.
3. For several related changes (e.g. a trigger plus the tag that uses it), prefer \`gtm_workspace\` 'bulkUpdate': one atomic call, new entities get temporary IDs "new_1", "new_2"... that other entities in the same request can reference.
4. Check your work: \`gtm_workspace\` 'getStatus' lists changes and merge conflicts; 'quickPreview' compiles the workspace and reports compiler errors without publishing.
5. If the container moved on since the workspace was created, run 'sync', then resolve any conflicts with 'resolveConflict'.
6. Ship: \`gtm_workspace\` 'createVersion' (give it a name and notes describing the change), then \`gtm_version\` 'publish' with the new containerVersionId and its fingerprint. Publishing affects live traffic — confirm with the user first.
7. Rolling back is publishing the previous version (\`gtm_version_header\` 'list' to find it), not editing entities back by hand.`,

  naming: `# Naming conventions

Consistent names make containers auditable and searchable. A widely used pattern is \`<Type> - <Platform/Destination> - <Detail>\`:

- Tags: "GA4 - Event - purchase", "Meta - Pixel - PageView", "HTML - Hotjar - Loader".
- Triggers: "CE - purchase" (custom event), "Click - CTA - Book Demo", "PV - Checkout Pages".
- Variables: "DLV - ecommerce.value" (data layer), "JS - page language", "CONST - GA4 Measurement ID", "LT - Hostname to Stream ID" (lookup table).

Rules of thumb:
- Keep IDs, keys and measurement IDs in Constant variables, not hard-coded in every tag.
- Group related tags, triggers and variables with \`gtm_folder\` (e.g. one folder per vendor).
- Name workspaces and versions after the change they carry ("Add purchase tracking", ticket ID), never "test" or "new".
- Use the entity 'notes' field for why, not what.`,

  audit: `# Container audit checklist

Gather data read-only first: \`gtm_version\` 'live' (summary, then 'resourceType' pages for tags/triggers/variables), or the \`gtm_tag\` / \`gtm_trigger\` / \`gtm_variable\` 'list' actions on a workspace.

Check for:
1. Unused items: triggers no tag references (firingTriggerId/blockingTriggerId), variables no tag, trigger or variable references ({{Variable Name}}).
2. Paused tags ('paused': true) and tags with no firing trigger.
3. Duplicates: two tags sending the same event to the same destination, or more than one Google tag for the same tag ID.
4. Custom HTML ('html' tags) that a built-in or Community Gallery template could replace — templates run sandboxed with declared permissions; Custom HTML runs anything.
5. Hard-coded IDs repeated across tags instead of a Constant or lookup-table variable.
6. Consent: non-Google tags with 'consentSettings.consentStatus' "notSet" (Google tags have built-in consent checks); tags that set cookies firing before consent (see the 'consentMode' guide).
7. Trigger hygiene: tags firing on "All Pages" that only matter on a few; broad click triggers with no filter.
8. Naming and folder consistency (see the 'naming' guide).
9. Workspace hygiene: stale workspaces (\`gtm_workspace\` 'list') and versions without names or notes (\`gtm_version_header\` 'list').
10. Access: \`gtm_user_permission\` 'list' — remove people who no longer need access; keep publish rights to a few.

Report findings grouped by severity with the entity IDs, and propose fixes before changing anything.`,

  trackingPlan: `# Building a tracking plan

A tracking plan is agreed before implementation and is the contract between marketing, developers and GTM.

1. Start from business questions and KPIs, not from what is easy to track.
2. List events per key user action. For GA4 prefer the recommended event names (e.g. 'login', 'sign_up', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase', 'generate_lead') so reports work out of the box; use snake_case for custom events.
3. For each event define: trigger condition, parameters (name, type, example, required?), and destinations (GA4, Google Ads, Meta...).
4. Write the dataLayer spec developers implement, e.g. \`dataLayer.push({ event: "purchase", ecommerce: { transaction_id, value, currency, items: [...] } })\`. Push \`{ ecommerce: null }\` before each ecommerce event to clear stale data.
5. Map it to GTM: a Custom Event trigger per dataLayer event, Data Layer variables per parameter, one tag per event and destination.
6. Decide the consent category of every destination (see the 'consentMode' guide).
7. Define QA: how each event is verified (GTM Preview / \`gtm_workspace\` 'quickPreview', GA4 DebugView) before publishing.

Deliver it as a table: event | trigger | parameters | destinations | consent | status.`,

  consentMode: `# Consent Mode (v2)

- Consent types: 'ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization' (the last two required by Google for EEA traffic), plus 'functionality_storage', 'personalization_storage', 'security_storage'.
- The consent default must be set before any tag reads it: fire the CMP / default-consent tag on the "Consent Initialization - All Pages" trigger, and update consent from the CMP when the user chooses.
- Prefer a CMP's Community Gallery template (\`gtm_template\` 'importFromGallery') over Custom HTML.
- Google tags (Google tag, GA4, Google Ads, Floodlight) have built-in consent checks and adapt to consent state. Non-Google tags do not — give them additional consent checks: tag 'consentSettings' with consentStatus "needed" and the required consent types.
- Basic mode: tags don't load until consent is granted. Advanced mode: Google tags load with consent denied and send cookieless pings for modelling. Choose with the user/legal team; don't switch silently.
- Audit: every non-Google tag should have consentSettings other than "notSet"; Google tags rely on their built-in checks.`,

  serverSide: `# Server-side tagging

- A server container receives HTTP requests on your own (sub)domain, e.g. from the web container's Google tag with its server_container_url set, and forwards data to vendors.
- Clients (\`gtm_client\`) claim incoming requests and turn them into event data (e.g. the GA4 client for /g/collect). One client should claim each request type.
- Tags in the server container fire on that event data; triggers usually filter on Client Name and Event Name.
- Transformations (\`gtm_transformation\`) allow, exclude or augment event parameters before tags see them — the place to strip PII.
- Serve the container on a first-party subdomain (e.g. sgtm.example.com) so cookies are first-party and less affected by browser restrictions.
- Hosting: the server container needs a tagging server (Cloud Run, or a managed host such as Stape), provisioned with the Container Config string from GTM Admin > Container Settings.
- Test with the server container's Preview mode alongside the web container's, and check vendor-side deduplication when sending the same event from web and server.`,
} as const;

type GuideTopic = keyof typeof GUIDES;
const TOPICS = Object.keys(GUIDES) as [GuideTopic, ...GuideTopic[]];

export const guideActions = (server: McpServer): void => {
  server.registerTool(
    "gtm_guide",
    {
      description:
        "Returns Google Tag Manager best-practice guidance and step-by-step workflows as markdown. Read the relevant topic before planning changes: 'safeEditing' (workspace -> edit -> preview -> version -> publish, with this server's tools), 'naming' (naming conventions), 'audit' (container audit checklist), 'trackingPlan' (building a tracking plan and dataLayer spec), 'consentMode' (Consent Mode v2 setup), 'serverSide' (server-side tagging). Makes no API calls.",
      inputSchema: z.object({
        topic: z
          .enum(TOPICS)
          .describe(
            `The guidance topic to return. One of: ${TOPICS.map((t) => `'${t}'`).join(", ")}.`,
          ),
      }),
    },
    async ({ topic }): Promise<CallToolResult> => {
      log(`Running tool: gtm_guide with topic ${topic}`);

      return { content: [{ type: "text", text: GUIDES[topic] }] };
    },
  );
};
