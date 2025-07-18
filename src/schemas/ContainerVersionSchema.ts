import { z } from "zod";
import { BuiltInVariableSchemaFields } from "./BuiltInVariableSchema";
import { ClientSchemaFields } from "./ClientSchema";
import { CustomTemplateSchemaFields } from "./CustomTemplateSchema";
import { FolderSchemaFields } from "./FolderSchema";
import { GtagConfigSchemaFields } from "./GtagConfigSchema";
import { TagSchemaFields } from "./TagSchema";
import { TransformationSchemaFields } from "./TransformationSchema";
import { TriggerSchemaFields } from "./TriggerSchema";
import { VariableSchemaFields } from "./VariableSchema";
import { ZoneSchemaFields } from "./ZoneSchema";

export const ContainerVersionSchemaFields = {
  accountId: z.string().optional().describe("GTM Account ID."),
  containerId: z.string().optional().describe("GTM Container ID."),
  containerVersionId: z
    .string()
    .optional()
    .describe(
      "The Container Version ID uniquely identifies the GTM Container Version.",
    ),
  name: z.string().optional().describe("Container version display name."),
  deleted: z
    .boolean()
    .optional()
    .describe(
      "A value of true indicates this container version has been deleted.",
    ),
  description: z.string().optional().describe("Container version description."),
  container: z
    .any()
    .optional()
    .describe("The container that this version was taken from."),
  tag: z
    .array(z.object(TagSchemaFields))
    .optional()
    .describe("The tags in the container that this version was taken from."),
  trigger: z
    .array(z.object(TriggerSchemaFields))
    .optional()
    .describe(
      "The triggers in the container that this version was taken from.",
    ),
  variable: z
    .array(z.object(VariableSchemaFields))
    .optional()
    .describe(
      "The variables in the container that this version was taken from.",
    ),
  folder: z
    .array(z.object(FolderSchemaFields))
    .optional()
    .describe("The folders in the container that this version was taken from."),
  builtInVariable: z
    .array(z.object(BuiltInVariableSchemaFields))
    .optional()
    .describe(
      "The built-in variables in the container that this version was taken from.",
    ),
  fingerprint: z
    .string()
    .optional()
    .describe(
      "The fingerprint of the GTM Container Version as computed at storage time.",
    ),
  tagManagerUrl: z
    .string()
    .optional()
    .describe("Auto generated link to the tag manager UI."),
  zone: z
    .array(z.object(ZoneSchemaFields))
    .optional()
    .describe("The zones in the container that this version was taken from."),
  customTemplate: z
    .array(z.object(CustomTemplateSchemaFields))
    .optional()
    .describe(
      "The custom templates in the container that this version was taken from.",
    ),
  client: z
    .array(z.object(ClientSchemaFields))
    .optional()
    .describe("The clients in the container that this version was taken from."),
  gtagConfig: z
    .array(z.object(GtagConfigSchemaFields))
    .optional()
    .describe(
      "The Google tag configs in the container that this version was taken from.",
    ),
  transformation: z
    .array(z.object(TransformationSchemaFields))
    .optional()
    .describe(
      "The transformations in the container that this version was taken from.",
    ),
};
