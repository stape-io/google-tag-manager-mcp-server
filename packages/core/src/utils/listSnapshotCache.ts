import { tagmanager, tagmanager_v2 } from "@googleapis/tagmanager";
import {
  classifyGtmQuota,
  createObservedFetch,
  emitGtmUsage,
  GtmCacheOutcome,
  GtmCall,
  GtmUsageObserver,
} from "./gtmTelemetry.js";

export const LIST_SNAPSHOT_TTL_MS = 30_000;
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
}

export interface GtmSnapshotResult {
  items: GtmSnapshotItem[];
  cache: GtmCacheOutcome;
}

export interface GtmSnapshotBackend {
  read(request: GtmSnapshotRequest): Promise<GtmSnapshotResult>;
  beginMutation(): Promise<string>;
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

export class ListSnapshotCache implements GtmSnapshotBackend {
  private entries = new Map<string, SnapshotEntry>();
  private pending = new Map<string, Promise<GtmSnapshotItem[]>>();
  private mutations = new Map<string, number>();
  private generation = 0;
  private bytes = 0;

  constructor(
    private readonly options: {
      enabled?: boolean;
      observer?: GtmUsageObserver;
      ttlMs?: number;
      maxEntries?: number;
      maxBytes?: number;
    } = {},
  ) {}

  async read(request: GtmSnapshotRequest): Promise<GtmSnapshotResult> {
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
    const bypass = this.mutations.size > 0;
    const entry = this.entries.get(key);
    if (!bypass && !request.fresh && entry && entry.expiresAt > Date.now()) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return { items: entry.items, cache: "hit" };
    }
    if (request.fresh) this.remove(key);
    const existing = this.pending.get(key);
    if (existing && !bypass && !request.fresh) {
      emitGtmUsage(this.options.observer, {
        ...request.call,
        event: "snapshot_wait",
      });
      return { items: await existing, cache: "coalesced" };
    }

    const generation = this.generation;
    const fill = this.load(request).then((items) => {
      if (bypass) return items;
      if (generation !== this.generation) {
        throw new Error(
          "GTM data changed during this list request. Retry the list.",
        );
      }
      // Superseded by a fresh read: storing would overwrite its newer snapshot.
      if (this.pending.get(key) === fill) this.store(key, items);
      return items;
    });
    if (!bypass) this.pending.set(key, fill);
    try {
      return {
        items: await fill,
        cache: bypass || request.fresh ? "bypass" : "miss",
      };
    } finally {
      if (this.pending.get(key) === fill) this.pending.delete(key);
    }
  }

  async beginMutation(): Promise<string> {
    this.invalidate();
    const id = crypto.randomUUID();
    this.mutations.set(id, Date.now() + 120_000);
    return id;
  }

  async endMutation(id: string): Promise<void> {
    this.mutations.delete(id);
    this.invalidate();
  }

  async clear(): Promise<void> {
    this.invalidate();
  }

  private invalidate(): void {
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
  }

  private remove(key: string): void {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }

  private store(key: string, items: GtmSnapshotItem[]): void {
    const bytes = new TextEncoder().encode(JSON.stringify(items)).byteLength;
    const maxBytes = this.options.maxBytes ?? LIST_SNAPSHOT_MAX_BYTES;
    const maxEntries = this.options.maxEntries ?? LIST_SNAPSHOT_MAX_ENTRIES;
    if (bytes > maxBytes || maxEntries < 1) return;
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

  private async load(request: GtmSnapshotRequest): Promise<GtmSnapshotItem[]> {
    const resource = request.path.split("/").at(-1) as keyof typeof LIST_FIELDS;
    const parent = request.path.slice(0, request.path.lastIndexOf("/"));
    const field = LIST_FIELDS[resource];
    const client = tagmanager({
      version: "v2",
      headers: { Authorization: `Bearer ${request.token}` },
      fetchImplementation: createObservedFetch(
        this.options.observer,
        request.call,
      ),
      retryConfig: {
        shouldRetry: (error) => {
          const attempt = error.config?.retryConfig?.currentRetryAttempt ?? 0;
          const status = error.response?.status ?? 0;
          if (error.config?.signal?.aborted || error.code === "AbortError")
            return false;
          if (classifyGtmQuota(status, error.response?.data) === "daily")
            return false;
          return (
            attempt < (status === 0 ? 2 : 3) &&
            (status === 0 ||
              status === 408 ||
              status === 429 ||
              (status >= 500 && status <= 599))
          );
        },
      },
    });
    const items: GtmSnapshotItem[] = [];
    const seen = new Set<string>();
    let pageToken = "";
    try {
      do {
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
      } while (pageToken);
    } catch (error) {
      if (error instanceof Error && "code" in error && Number(error.code))
        throw new GtmGoogleError(Number(error.code), error.message);
      throw error;
    }
    return items;
  }
}
