import { create } from "./create";
import { entities } from "./entities";
import { get } from "./get";
import { list } from "./list";
import { moveEntitiesToFolder } from "./moveEntitiesToFolder";
import { remove } from "./remove";
import { revert } from "./revert";
import { update } from "./update";

export const folderTools = [
  create,
  remove,
  get,
  list,
  revert,
  update,
  entities,
  moveEntitiesToFolder,
];
