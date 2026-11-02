import { tagmanager, tagmanager_v2 } from "@googleapis/tagmanager";
import { paginateArray, type PaginationResult } from "./paginationUtils.js";
import type { GtmRequestScheduler } from "./gtmRequestScheduler.js";
import {
  createScheduledGtmAdapter,
  GTM_REQUEST_DEADLINE_MS,
  GTM_LIST_DEADLINE_MS,
} from "./gtmScheduledAdapter.js";
import { GtmSchedulingError, withGtmAbort } from "./gtmRequestScheduler.js";
import { getGtmRetryOptions } from "./gtmRequestPolicy.js";
import {
  createObservedGtmAdapter,
  emitGtmUsage,
  GtmCacheOutcome,
  GtmCall,
  GtmUsageObserver,
} from "./gtmTelemetry.js";

export const LIST_SNAPSHOT_TTL_MS = 30_000;
export const LIST_SNAPSHOT_JOIN_WINDOW_MS = 30_000;
export const LIST_SNAPSHOT_MAX_ENTRIES = 20;
export const LIST_SNAPSHOT_MAX_BYTES = 8 * 1024 * 1024;

const LIST_FIELDS = {
  tags: "tag",
  triggers: "trigger",
  variables: "variable",
} as const;

export type GtmSnapshotItem =
  | tagmanager_v2.Schema$Tag
  | tagmanager_v2.Schema$Trigger
  | tagmanager_v2.Schema$Variable;

export interface GtmSnapshotRequest {
  path: string;
  token: string;
  namespace: string;
  fresh: boolean;
  call: GtmCall;
  signal?: AbortSignal;
  deadline?: number;
}

export interface GtmSnapshotResult {
  items: GtmSnapshotItem[];
  cache: GtmCacheOutcome;
}

export interface GtmSnapshotPageRequest extends GtmSnapshotRequest {
  page: number;
  itemsPerPage: number;
}

export interface GtmSnapshotPageResult extends PaginationResult<GtmSnapshotItem> {
  cache: GtmCacheOutcome;
}

export interface GtmSnapshotBackend {
  readPage?(request: GtmSnapshotPageRequest): Promise<GtmSnapshotPageResult>;
  read(request: GtmSnapshotRequest): Promise<GtmSnapshotResult>;
  beginMutation(id?: string): Promise<string>;
  endMutation(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class GtmGoogleError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

export function isGtmSnapshotPath(path: string): boolean {
  return /^accounts\/[A-Za-z0-9_-]+\/containers\/[A-Za-z0-9_-]+\/workspaces\/[A-Za-z0-9_-]+\/(tags|triggers|variables)$/.test(
    path,
  );
}

interface SnapshotEntry {
  items: GtmSnapshotItem[];
  expiresAt: number;
  bytes: number;
}

interface PendingSnapshot {
  key: string;
  joinUntil: number;
  deadline?: number;
  promise: Promise<GtmSnapshotItem[]>;
  controller: AbortController;
  waiters: number;
  family: SnapshotFamily;
}

// Only automatic replacements share results. Fresh reads and invalidation
// establish a new family, preserving their ordering barriers.
interface SnapshotFamily {
  completed: Promise<GtmSnapshotItem[]>;
  complete(items: GtmSnapshotItem[]): void;
  winner?: PendingSnapshot;
}

function createSnapshotFamily(): SnapshotFamily {
  let complete!: SnapshotFamily["complete"];
  const completed = new Promise<GtmSnapshotItem[]>((resolve) => {
    complete = resolve;
  });
  return { completed, complete };
}

const SNAPSHOT_REUSED = new Error("Completed snapshot reused.");

export class ListSnapshotCache implements GtmSnapshotBackend {
  private entries = new Map<string, SnapshotEntry>();
  private pending = new Map<string, PendingSnapshot>();
  private mutations = new Map<string, number>();
  private endedMutations = new Map<string, number>();
  private generation = 0;
  private bytes = 0;

  constructor(
    private readonly options: {
      enabled?: boolean;
      scheduler?: GtmRequestScheduler;
      observer?: GtmUsageObserver;
      ttlMs?: number;
      maxEntries?: number;
      maxBytes?: number;
    } = {},
  ) {}

  async read(request: GtmSnapshotRequest): Promise<GtmSnapshotResult> {
    const result = await this.readInternal(request);
    return { ...result, items: structuredClone(result.items) };
  }

  private async readInternal(
    request: GtmSnapshotRequest,
  ): Promise<GtmSnapshotResult> {
    request.signal?.throwIfAborted();
    if (request.deadline !== undefined && request.deadline <= Date.now())
      throw new GtmSchedulingError("deadline");
    if (!isGtmSnapshotPath(request.path))
      throw new Error("Unsupported GTM snapshot path.");
    if (this.options.enabled === false)
      return { items: await this.load(request), cache: "bypass" };
    this.prune();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(request.token),
    );
    const credential = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const key = JSON.stringify([request.namespace, credential, request.path]);
    request.signal?.throwIfAborted();
    if (request.deadline !== undefined && request.deadline <= Date.now())
      throw new GtmSchedulingError("deadline");
    const bypass = this.mutations.size > 0;
    const entry = this.entries.get(key);
    if (!bypass && !request.fresh && entry && entry.expiresAt > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return { items: entry.items, cache: "hit" };
    }
    if (request.fresh) this.remove(key);
    const existing = this.pending.get(key);
    if (
      existing &&
      !existing.controller.signal.aborted &&
      Date.now() < existing.joinUntil &&
      (existing.deadline === undefined ||
        existing.deadline - Date.now() >= GTM_REQUEST_DEADLINE_MS) &&
      !bypass &&
      !request.fresh
    ) {
      emitGtmUsage(this.options.observer, {
        ...request.call,
        event: "snapshot_wait",
      });
      return {
        items: await this.waitFor(existing, request),
        cache: "coalesced",
      };
    }

    const generation = this.generation;
    const scanDeadline = this.options.scheduler
      ? Date.now() + GTM_LIST_DEADLINE_MS
      : undefined;
    const fill: PendingSnapshot = {
      key,
      deadline: scanDeadline,
      // Stop admitting readers to inactive scans without timing out their
      // existing subscribers. Identity checks below protect replacement fills.
      joinUntil: Date.now() + LIST_SNAPSHOT_JOIN_WINDOW_MS,
      controller: new AbortController(),
      waiters: 0,
      promise: undefined!,
      family:
        !request.fresh &&
        !bypass &&
        existing &&
        !existing.controller.signal.aborted
          ? existing.family
          : createSnapshotFamily(),
    };
    // Scheduled producers have a bounded scan budget. Each subscriber enforces
    // its own deadline without cancelling readers who still have time left.
    const scanTimer =
      scanDeadline === undefined
        ? undefined
        : setTimeout(
            () => fill.controller.abort(new GtmSchedulingError("deadline")),
            GTM_LIST_DEADLINE_MS,
          );
    const producer = withGtmAbort(
      this.load(
        {
          ...request,
          deadline: scanDeadline,
          signal: fill.controller.signal,
        },
        () => {
          fill.joinUntil = Date.now() + LIST_SNAPSHOT_JOIN_WINDOW_MS;
        },
      ),
      fill.controller.signal,
    ).then((items) => {
      if (bypass || fill.controller.signal.aborted) return items;
      if (generation !== this.generation) return items;
      // A completed scan may satisfy its automatic replacements, but never
      // a fresh read, a mutation generation, or a family that already won.
      if (
        this.pending.get(key)?.family === fill.family &&
        !fill.family.winner
      ) {
        fill.family.winner = fill;
        this.store(key, items);
        fill.family.complete(items);
      }
      return items;
    });
    fill.promise = Promise.race([producer, fill.family.completed])
      .then((items) => {
        // Readers already have the completed result; stop redundant pagination.
        if (fill.family.winner && fill.family.winner !== fill)
          fill.controller.abort(SNAPSHOT_REUSED);
        return items;
      })
      .finally(() => {
        clearTimeout(scanTimer);
        if (this.pending.get(key) === fill) this.pending.delete(key);
      });
    if (!bypass) this.pending.set(key, fill);
    return {
      items: await this.waitFor(fill, request),
      cache:
        bypass || request.fresh || generation !== this.generation
          ? "bypass"
          : fill.family.winner && fill.family.winner !== fill
            ? "coalesced"
            : "miss",
    };
  }

  private async waitFor(
    fill: PendingSnapshot,
    request: GtmSnapshotRequest,
  ): Promise<GtmSnapshotItem[]> {
    fill.waiters++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const signal = request.signal
      ? AbortSignal.any([controller.signal, request.signal])
      : controller.signal;
    if (request.deadline !== undefined) {
      if (request.deadline <= Date.now())
        controller.abort(new GtmSchedulingError("deadline"));
      else
        timer = setTimeout(
          () => controller.abort(new GtmSchedulingError("deadline")),
          request.deadline - Date.now(),
        );
    }
    try {
      return await withGtmAbort(fill.promise, signal);
    } finally {
      clearTimeout(timer);
      if (--fill.waiters === 0) {
        // Detach before aborting: producer rejection/cleanup may be delayed.
        if (this.pending.get(fill.key) === fill) this.pending.delete(fill.key);
        fill.controller.abort(signal.aborted ? signal.reason : undefined);
      }
    }
  }

  async readPage(
    request: GtmSnapshotPageRequest,
  ): Promise<GtmSnapshotPageResult> {
    const { items, cache } = await this.readInternal(request);
    return {
      ...structuredClone(
        paginateArray(items, request.page, request.itemsPerPage),
      ),
      cache,
    };
  }

  async beginMutation(id: string = crypto.randomUUID()): Promise<string> {
    this.prune();
    // Correlated control retries and late starts are idempotent.
    if (this.endedMutations.has(id) || this.mutations.has(id)) return id;
    this.invalidate();
    // end can arrive first when a hosted start request is delayed.
    this.mutations.set(id, Date.now() + 120_000);
    return id;
  }

  async endMutation(id: string): Promise<void> {
    this.prune();
    if (this.endedMutations.has(id)) return;
    this.mutations.delete(id);
    this.endedMutations.set(id, Date.now() + 120_000);
    if (this.endedMutations.size > 1_000)
      this.endedMutations.delete(this.endedMutations.keys().next().value!);
    this.invalidate();
  }

  async clear(): Promise<void> {
    this.invalidate();
  }

  private invalidate(): void {
    // Mutations can affect resources absent from the request path (container
    // combine and move_tag_id), so invalidate the entire backend across clients.
    // Unrelated tenants should use separate backend instances.
    this.generation++;
    this.entries.clear();
    this.pending.clear();
    this.bytes = 0;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries)
      if (entry.expiresAt <= now) this.remove(key);
    for (const [id, expiry] of this.mutations)
      if (expiry <= now) this.mutations.delete(id);
    for (const [id, expiry] of this.endedMutations)
      if (expiry <= now) this.endedMutations.delete(id);
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  private store(key: string, items: GtmSnapshotItem[]): void {
    const maxBytes = this.options.maxBytes ?? LIST_SNAPSHOT_MAX_BYTES;
    const maxEntries = this.options.maxEntries ?? LIST_SNAPSHOT_MAX_ENTRIES;
    if (maxEntries < 1 || maxBytes < 2) return;
    // Account for the exact JSON-array bytes one entity at a time. Avoid a
    // second full-snapshot string/byte buffer, and stop once over budget.
    const encoder = new TextEncoder();
    let bytes = 2; // []
    for (let index = 0; index < items.length; index++) {
      bytes +=
        (index ? 1 : 0) +
        encoder.encode(JSON.stringify(items[index]) ?? "null").byteLength;
      if (bytes > maxBytes) return;
    }
    this.remove(key);
    while (this.entries.size >= maxEntries || this.bytes + bytes > maxBytes) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    this.entries.set(key, {
      items,
      bytes,
      expiresAt: Date.now() + (this.options.ttlMs ?? LIST_SNAPSHOT_TTL_MS),
    });
    this.bytes += bytes;
  }

  private async load(
    request: GtmSnapshotRequest,
    onPage?: () => void,
  ): Promise<GtmSnapshotItem[]> {
    const resource = request.path.split("/").at(-1) as keyof typeof LIST_FIELDS;
    const parent = request.path.slice(0, request.path.lastIndexOf("/"));
    const field = LIST_FIELDS[resource];
    const observer: GtmUsageObserver | undefined = this.options.observer
      ? (event): void => {
          // Internal successful reuse is not a user's cancelled queue wait.
          if (
            event.event === "queue_cancelled" &&
            request.signal?.reason === SNAPSHOT_REUSED
          )
            return;
          this.options.observer?.(event);
        }
      : undefined;
    const client = tagmanager({
      version: "v2",
      headers: { Authorization: `Bearer ${request.token}` },
      signal: request.signal,
      adapter: this.options.scheduler
        ? createScheduledGtmAdapter(
            this.options.scheduler,
            observer,
            request.call,
            request.deadline ?? Date.now() + GTM_LIST_DEADLINE_MS,
            request.signal,
          )
        : createObservedGtmAdapter(observer, request.call),
      ...getGtmRetryOptions(Boolean(this.options.scheduler)),
    });
    const items: GtmSnapshotItem[] = [];
    const seen = new Set<string>();
    let pageToken = "";
    try {
      do {
        request.signal?.throwIfAborted();
        const params = { parent, pageToken };
        const response =
          resource === "tags"
            ? await client.accounts.containers.workspaces.tags.list(params)
            : resource === "triggers"
              ? await client.accounts.containers.workspaces.triggers.list(
                  params,
                )
              : await client.accounts.containers.workspaces.variables.list(
                  params,
                );
        const body = response.data as tagmanager_v2.Schema$ListTagsResponse &
          tagmanager_v2.Schema$ListTriggersResponse &
          tagmanager_v2.Schema$ListVariablesResponse;
        items.push(...(body[field] ?? []));
        pageToken = body.nextPageToken ?? "";
        if (pageToken && seen.has(pageToken))
          throw new Error("Google returned a repeated pagination token.");
        seen.add(pageToken);
        onPage?.();
      } while (pageToken);
    } catch (error) {
      if (error instanceof Error && "code" in error && Number(error.code))
        throw new GtmGoogleError(Number(error.code), error.message);
      throw error;
    }
    return items;
  }
}
