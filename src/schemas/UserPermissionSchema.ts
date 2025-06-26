import { z } from "zod";

/**
 * UserPermission resource schema fields (writable fields only)
 * https://developers.google.com/tag-platform/tag-manager/api/reference/rest/v2/accounts.user_permissions#UserPermission
 */
const AccountPermissionEnum = z.enum([
  "accountPermissionUnspecified",
  "noAccess",
  "user",
  "admin",
]);

const ContainerPermissionEnum = z.enum([
  "containerPermissionUnspecified",
  "noAccess",
  "read",
  "edit",
  "approve",
  "publish",
]);

const AccountAccessSchema = z.object({
  permission: AccountPermissionEnum.optional().describe(
    "Whether the user has no access, user access, or admin access to an account.",
  ),
});

const ContainerAccessSchema = z.object({
  containerId: z.string().describe("GTM Container ID."),
  permission: ContainerPermissionEnum.optional().describe(
    "List of Container permissions.",
  ),
});

export const UserPermissionSchemaFields = {
  accountId: z
    .string()
    .describe("The Account ID uniquely identifies the GTM Account."),
  userPermissionId: z
    .string()
    .optional()
    .describe("The User Permission ID uniquely identifies the GTM Account."),
  emailAddress: z.string().describe("User's email address."),
  accountAccess: AccountAccessSchema.optional().describe(
    "GTM Account access permissions.",
  ),
  containerAccess: z
    .array(ContainerAccessSchema)
    .optional()
    .describe("GTM Container access permissions."),
};
