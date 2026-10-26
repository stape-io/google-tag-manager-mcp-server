import {
  GtmGoogleError,
  type GtmSnapshotRequest,
  ListSnapshotCache,
} from "google-tag-manager-mcp-core";
import { z } from "zod";
import { createWorkerUsageObserver } from "./gtmUsage";

const SnapshotRequest = z.object({
  path: z.string(),
  token: z.string().min(1),
  namespace: z.string(),
  fresh: z.boolean(),
  call: z.object({ tool: z.string(), action: z.string(), callId: z.string() }),
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
  z.object({ operation: z.literal("beginMutation") }),
  z.object({ operation: z.literal("endMutation"), id: z.string() }),
  z.object({ operation: z.literal("clear") }),
]);

export class GtmReadCache {
  private readonly cache: ListSnapshotCache;

  constructor(_state: DurableObjectState, env: Env) {
    this.cache = new ListSnapshotCache({
      observer: createWorkerUsageObserver(env),
    });
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const input = Operation.parse(await request.json());
      switch (input.operation) {
        case "read":
          return Response.json({
            result: await this.cache.read(input.request),
          });
        case "readPage":
          return Response.json({
            result: await this.cache.readPage(input.request),
          });
        case "beginMutation":
          return Response.json({ result: await this.cache.beginMutation() });
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
