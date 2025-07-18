import { combine } from "./combine";
import { create } from "./create";
import { get } from "./get";
import { list } from "./list";
import { lookup } from "./lookup";
import { moveTagId } from "./moveTagId";
import { remove } from "./remove";
import { snippet } from "./snippet";
import { update } from "./update";

export const containerTools = [
  create,
  remove,
  get,
  list,
  update,
  combine,
  lookup,
  snippet,
  moveTagId,
];
