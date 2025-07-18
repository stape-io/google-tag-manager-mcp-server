import { create } from "./create";
import { get } from "./get";
import { list } from "./list";
import { reauthorize } from "./reauthorize";
import { remove } from "./remove";
import { update } from "./update";

export const environmentTools = [
  create,
  remove,
  get,
  list,
  reauthorize,
  update,
];
