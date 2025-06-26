import { create } from "./create";
import { createVersion } from "./createVersion";
import { get } from "./get";
import { getStatus } from "./getStatus";
import { list } from "./list";
import { quickPreview } from "./quickPreview";
import { remove } from "./remove";
import { resolveConflict } from "./resolveConflict";
import { sync } from "./sync";
import { update } from "./update";

export const workspaceTools = [
  create,
  remove,
  get,
  list,
  createVersion,
  update,
  getStatus,
  sync,
  quickPreview,
  resolveConflict,
];
