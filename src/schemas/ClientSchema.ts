import { z } from "zod";
import { ParameterSchema } from "./ParameterSchema";

/**
 * Client resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.containers.workspaces.clients#Client
 */
export const ClientSchemaFields = {
  accountId: z.string().describe("GTM Account ID."),
  containerId: z.string().describe("GTM Container ID."),
  workspaceId: z.string().describe("GTM Workspace ID."),
  clientId: z
    .string()
    .optional()
    .describe("The Client ID uniquely identifies the GTM client."),
  name: z.string().optional().describe("Client display name."),
  type: z.string().optional().describe("Client type."),
  parameter: z
    .array(ParameterSchema)
    .optional()
    .describe("The client's parameters."),
  priority: z
    .number()
    .optional()
    .describe("Priority determines relative firing order."),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Client as computed at storage time. This value is recomputed whenever the client is modified.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  parentFolderId: z.string().optional().describe("Parent folder id."),
  notes: z
    .string()
    .optional()
    .describe("User notes on how to apply this tag in the container."),
};
