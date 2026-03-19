import { createRoute, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { GlobalContextService } from "@repo/core";
import { ConnectionSchema } from "@repo/schema";

// ── List connections ───────────────────────────────────────────────────────

export const listConnectionsRoute = createRoute({
  method: "get",
  path: "/api/connections",
  request: {
    query: z.object({
      limit: z.string().regex(/^\d+$/).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ connections: z.array(ConnectionSchema) }),
        },
      },
      description: "List of connections ordered by lastSeen descending",
    },
  },
});

// ── Create connection ──────────────────────────────────────────────────────

export const createConnectionRoute = createRoute({
  method: "post",
  path: "/api/connections",
  responses: {
    201: {
      content: {
        "application/json": { schema: ConnectionSchema },
      },
      description: "Newly created connection",
    },
  },
});

// ── SSE events ─────────────────────────────────────────────────────────────

export const connectionEventsRoute = createRoute({
  method: "get",
  path: "/api/connections/{id}/events",
  request: {
    params: z.object({
      id: z.string().min(1, "Connection ID is required"),
    }),
    headers: z.object({
      // Header is optional — native EventSource cannot send custom headers.
      // If provided it must match the path param; if absent the path param is used.
      "x-connection-id": z.string().min(1).optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "text/event-stream": { schema: z.string() },
      },
      description: "Server-sent events stream",
    },
    403: {
      content: {
        "application/json": { schema: z.object({ error: z.string() }) },
      },
      description: "Forbidden - connection ID mismatch",
    },
  },
});

// ── Registration ───────────────────────────────────────────────────────────

export function registerConnectionRoutes(
  app: any,
  connectionRepository: { findAll(opts?: { limit?: number }): Promise<any[]>; create(id: string): Promise<any> },
  globalContextService: GlobalContextService,
) {
  app.openapi(listConnectionsRoute, async (c: Context) => {
    const limitParam = c.req.query("limit");
    const limit = limitParam !== undefined ? parseInt(limitParam, 10) : undefined;
    const conns = await connectionRepository.findAll(limit !== undefined ? { limit } : undefined);
    return c.json({ connections: conns });
  });

  app.openapi(createConnectionRoute, async (c: Context) => {
    const id = crypto.randomUUID();
    const conn = await connectionRepository.create(id);
    return c.json(conn, 201);
  });

  app.openapi(connectionEventsRoute, async (c: Context) => {
    try {
      if (!globalContextService) {
        return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
      }

      const pathId = c.req.param("id");
      const headerConnectionId = c.req.header("X-Connection-ID");

      // Header is optional — fall back to path param if absent
      const connectionId = headerConnectionId ?? pathId;

      // If header was provided it must match the path param
      if (headerConnectionId && headerConnectionId !== pathId) {
        return c.json({ error: "Connection ID mismatch" }, 403);
      }

      const lastEventId = Number(c.req.header("Last-Event-ID") ?? "0");

      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      return streamSSE(c, async (stream) => {
        try {
          let nextEventId = lastEventId + 1;

          if (lastEventId > 0) {
            // Reconnect: replay missed events from ring buffer
            const replayed = globalContextService.replayEvents?.(connectionId, lastEventId);
            if (replayed === "resync") {
              await stream.writeSSE({ event: "resync", data: "{}" });
              nextEventId = 0;
            } else if (replayed && replayed.length > 0) {
              for (const event of replayed) {
                await stream.writeSSE({
                  id: String(nextEventId++),
                  event: event.type,
                  data: event.type === "resync" ? "{}" : JSON.stringify(event.data),
                });
              }
            }
          }

          // Always send current context on connect (fresh or after replay)
          const context = await globalContextService.getContext(connectionId);
          await stream.writeSSE({
            id: String(nextEventId++),
            event: "context",
            data: JSON.stringify(context),
          });

          const unsubscribe = globalContextService.subscribe(connectionId, async (event) => {
            await stream.writeSSE({
              id: String(nextEventId++),
              event: event.type,
              data: event.type === "resync" ? "{}" : JSON.stringify(event.data),
            });
          });

          const heartbeat = setInterval(async () => {
            await stream.writeSSE({ data: "" });
          }, 30000);

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              unsubscribe();
              clearInterval(heartbeat);
              resolve();
            });
          });
        } catch (error) {
          console.error("Error in SSE stream:", error);
          throw error;
        }
      });
    } catch (error) {
      console.error("Error in SSE endpoint:", error);
      return c.json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
    }
  });
}

// Keep old export for any callers that haven't been updated yet
export function registerConnectionEventsRoute(
  app: any,
  globalContextService: GlobalContextService,
) {
  // No-op shim — registerConnectionRoutes now handles all connection routes
  void app;
  void globalContextService;
}
