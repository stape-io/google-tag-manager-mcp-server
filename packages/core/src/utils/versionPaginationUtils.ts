import { tagmanager_v2 } from "@googleapis/tagmanager";
import { paginateArray } from "./paginationUtils.js";
import Schema$ContainerVersion = tagmanager_v2.Schema$ContainerVersion;

export const ITEMS_PER_PAGE = 20;
export const SUMMARY_SAMPLE_SIZE = 5;

export type ResourceType =
  | "tag"
  | "trigger"
  | "variable"
  | "folder"
  | "builtInVariable"
  | "zone"
  | "customTemplate"
  | "client"
  | "gtagConfig"
  | "transformation";

export interface ProcessedVersionResponse {
  version: Partial<Schema$ContainerVersion>;
  summary?: Record<string, number>;

  [key: string]: unknown;
}

export function processVersionData(
  versionData: Schema$ContainerVersion,
  resourceType?: ResourceType,
  page?: number,
  itemsPerPage?: number,
  includeSummary?: boolean,
): ProcessedVersionResponse {
  const {
    tag,
    trigger,
    variable,
    folder,
    builtInVariable,
    zone,
    customTemplate,
    client,
    gtagConfig,
    transformation,
    ...baseVersion
  } = versionData;

  // If no resourceType specified, return summary mode
  if (!resourceType) {
    const summary = {
      tagCount: tag?.length || 0,
      triggerCount: trigger?.length || 0,
      variableCount: variable?.length || 0,
      folderCount: folder?.length || 0,
      builtInVariableCount: builtInVariable?.length || 0,
      zoneCount: zone?.length || 0,
      customTemplateCount: customTemplate?.length || 0,
      clientCount: client?.length || 0,
      gtagConfigCount: gtagConfig?.length || 0,
      transformationCount: transformation?.length || 0,
    };

    return {
      version: baseVersion,
      summary,
      tagSample: tag?.slice(0, SUMMARY_SAMPLE_SIZE),
      triggerSample: trigger?.slice(0, SUMMARY_SAMPLE_SIZE),
      variableSample: variable?.slice(0, SUMMARY_SAMPLE_SIZE),
      folderSample: folder?.slice(0, SUMMARY_SAMPLE_SIZE),
      builtInVariableSample: builtInVariable?.slice(0, SUMMARY_SAMPLE_SIZE),
      zoneSample: zone?.slice(0, SUMMARY_SAMPLE_SIZE),
      customTemplateSample: customTemplate?.slice(0, SUMMARY_SAMPLE_SIZE),
      clientSample: client?.slice(0, SUMMARY_SAMPLE_SIZE),
      gtagConfigSample: gtagConfig?.slice(0, SUMMARY_SAMPLE_SIZE),
      transformationSample: transformation?.slice(0, SUMMARY_SAMPLE_SIZE),
    };
  }

  // Paginate specific resource type
  const resourceMap: Record<ResourceType, unknown[] | undefined> = {
    tag,
    trigger,
    variable,
    folder,
    builtInVariable,
    zone,
    customTemplate,
    client,
    gtagConfig,
    transformation,
  };

  const selectedResource = resourceMap[resourceType] || [];
  const paginatedResult = paginateArray(
    selectedResource,
    page || 1,
    itemsPerPage || ITEMS_PER_PAGE,
  );

  const result: ProcessedVersionResponse = {
    version: baseVersion,
    [resourceType]: paginatedResult.data,
    [`${resourceType}Pagination`]: paginatedResult.pagination,
  };

  // Add summary if requested
  if (includeSummary) {
    result.summary = {
      tagCount: tag?.length || 0,
      triggerCount: trigger?.length || 0,
      variableCount: variable?.length || 0,
      folderCount: folder?.length || 0,
      builtInVariableCount: builtInVariable?.length || 0,
      zoneCount: zone?.length || 0,
      customTemplateCount: customTemplate?.length || 0,
      clientCount: client?.length || 0,
      gtagConfigCount: gtagConfig?.length || 0,
      transformationCount: transformation?.length || 0,
    };
  }

  return result;
}
