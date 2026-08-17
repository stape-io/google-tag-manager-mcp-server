import { GtmToolRegistration } from "../types/index.js";
import { accountActions } from "./accountActions.js";
import { builtInVariableActions } from "./builtInVariableActions.js";
import { clientActions } from "./clientActions.js";
import { containerActions } from "./containerActions.js";
import { destinationActions } from "./destinationActions.js";
import { environmentActions } from "./environmentActions.js";
import { folderActions } from "./folderActions.js";
import { gtagConfigActions } from "./gtagConfigActions.js";
import { tagActions } from "./tagActions.js";
import { templateActions } from "./templateActions.js";
import { transformationActions } from "./transformationActions.js";
import { triggerActions } from "./triggerActions.js";
import { userPermissionActions } from "./userPermissionActions.js";
import { variableActions } from "./variableActions.js";
import { versionHeaderActions } from "./versionHeaderActions.js";
import { versionActions } from "./versionActions.js";
import { workspaceActions } from "./workspaceActions.js";
import { zoneActions } from "./zoneActions.js";

export * from "./accountActions.js";
export * from "./builtInVariableActions.js";
export * from "./clientActions.js";
export * from "./containerActions.js";
export * from "./destinationActions.js";
export * from "./environmentActions.js";
export * from "./folderActions.js";
export * from "./gtagConfigActions.js";
export * from "./tagActions.js";
export * from "./templateActions.js";
export * from "./transformationActions.js";
export * from "./triggerActions.js";
export * from "./userPermissionActions.js";
export * from "./variableActions.js";
export * from "./versionHeaderActions.js";
export * from "./versionActions.js";
export * from "./workspaceActions.js";
export * from "./zoneActions.js";

export const tools: GtmToolRegistration[] = [
  accountActions,
  builtInVariableActions,
  clientActions,
  containerActions,
  destinationActions,
  environmentActions,
  folderActions,
  gtagConfigActions,
  tagActions,
  templateActions,
  transformationActions,
  triggerActions,
  userPermissionActions,
  variableActions,
  versionHeaderActions,
  versionActions,
  workspaceActions,
  zoneActions,
];
