import {
  GtmGoogleError,
  type GtmSnapshotRequest,
  ListSnapshotCache,
} from "google-tag-manager-mcp-core";
import { z } from "zod";
import { createHostedGtmScheduler } from "./createHostedGtmScheduler";
import { createWorkerUsageObserver } from "./gtmUsage";

const SnapshotRequest = z.object({
  path: z.string(),
  token: z.string().min(1),
  namespace: z.string(),
  fresh: z.boolean(),
  call: z.object({ tool: z.string(), action: z.string(), callId: z.string() }),
  deadline: z.number().finite().optional(),
}) satisfies z.ZodType<GtmSnapshotRequest>;

const Operation = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("read"), request: SnapshotRequest }),
  z.object({
    operation: z.literal("readPage"),
    request: SnapshotRequest.extend({
      page: z.number().min(1),
      itemsPerPage: z.number().min(1),
    }),
  }),
  z.object({
    operation: z.literal("beginMutation"),
    id: z.string().optional(),
  }),
  z.object({ operation: z.literal("endMutation"), id: z.string() }),
  z.object({ operation: z.literal("clear") }),
  z.object({ operation: z.literal("cancel"), callId: z.string() }),
]);

export class GtmReadCache {
  private readonly cache: ListSnapshotCache;
  private readonly active = new Map<string, AbortController>();
  private readonly cancelled = new Map<string, number>();

  constructor(_state: DurableObjectState, env: Env) {
    this.cache = new ListSnapshotCache({
      observer: createWorkerUsageObserver(env),
      scheduler: createHostedGtmScheduler(env),
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const input = Operation.parse(await request.json());
      for (const [callId, expires] of this.cancelled)
        if (expires <= Date.now()) this.cancelled.delete(callId);
      if (input.operation === "cancel") {
        this.active.get(input.callId)?.abort();
        // Also cover cancellation arriving before its read subrequest.
        this.cancelled.set(input.callId, Date.now() + 30_000);
        if (this.cancelled.size > 1_000)
          this.cancelled.delete(this.cancelled.keys().next().value!);
        return Response.json({ result: null });
      }
      if (input.operation === "read" || input.operation === "readPage") {
        const callId = input.request.call.callId;
        const controller = new AbortController();
        this.active.set(callId, controller);
        if (this.cancelled.has(callId)) controller.abort();
        Object.assign(input.request, { signal: controller.signal });
        try {
          return Response.json({
            result:
              input.operation === "read"
                ? await this.cache.read(input.request)
                : await this.cache.readPage(input.request),
          });
        } finally {
          this.active.delete(callId);
        }
      }
      switch (input.operation) {
        case "beginMutation":
          return Response.json({
            result: await this.cache.beginMutation(input.id),
          });
        case "endMutation":
          await this.cache.endMutation(input.id);
          break;
        case "clear":
          await this.cache.clear();
          break;
      }
      return Response.json({ result: null });
    } catch (error) {
      return Response.json({
        error: {
          code: error instanceof GtmGoogleError ? error.code : undefined,
          message:
            error instanceof Error
              ? error.message
              : "GTM cache request failed.",
        },
      });
    }
  }
}
