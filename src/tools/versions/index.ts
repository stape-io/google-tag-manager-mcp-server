import { get } from "./get";
import { live } from "./live";
import { publish } from "./publish";
import { remove } from "./remove";
import { setLatest } from "./setLatest";
import { undelete } from "./undelete";
import { update } from "./update";

export const versionTools = [
  remove,
  get,
  update,
  live,
  publish,
  setLatest,
  undelete,
];
