import { createRoute, z } from "@hono/zod-openapi";
import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import type { GlobalContextService } from "@repo/core";

export const connectionEventsRoute = createRoute({
  method: "get",
  path: "/api/connections/{id}/events",
  request: {
    params: z.object({
      id: z.string().min(1, "Connection ID is required"),
    }),
    headers: z.object({
      "x-connection-id": z.string().min(1, "X-Connection-ID header is required"),
    }),
  },
  responses: {
    200: {
      content: {
        "text/event-stream": {
          schema: z.string(),
        },
      },
      description: "Server-sent events stream",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Bad request",
    },
    403: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Forbidden - connection ID mismatch",
    },
  },
});

export function registerConnectionEventsRoute(
  app: any,
  globalContextService: GlobalContextService,
) {
  app.openapi(connectionEventsRoute, async (c: Context) => {
    try {
      if (!globalContextService) {
        return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
      }

      const connectionId = c.req.param("id");
      const headerConnectionId = c.req.header("X-Connection-ID");

      if (!headerConnectionId) {
        return c.json({ error: "X-Connection-ID header is required" }, 400);
      }

      // Security: ensure the connection ID in the path matches the header
      if (connectionId !== headerConnectionId) {
        return c.json({ error: "Connection ID mismatch" }, 403);
      }

      const lastEventId = Number(c.req.header("Last-Event-ID") ?? "0");

      // Set SSE headers
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      return streamSSE(c, async (stream) => {
        try {
          let nextEventId = lastEventId + 1;

          // Replay missed events from ring buffer
          const replayed = globalContextService.replayEvents?.(connectionId, lastEventId);
          if (replayed === "resync") {
            await stream.writeSSE({
              event: "resync",
              data: "{}",
            });
            nextEventId = 0; // Reset after resync
          } else if (replayed && replayed.length > 0) {
            for (const event of replayed) {
              await stream.writeSSE({
                id: String(nextEventId++),
                event: event.type,
                data: event.type === "resync" ? "{}" : JSON.stringify(event.data),
              });
            }
          }

          // Send initial context snapshot if no events were replayed
          if (!replayed || replayed.length === 0) {
            const context = await globalContextService.getContext(connectionId);
            await stream.writeSSE({
              id: String(nextEventId++),
              event: "context",
              data: JSON.stringify(context),
            });
          }

          // Subscribe to new events
          const unsubscribe = globalContextService.subscribe(connectionId, async (event) => {
            await stream.writeSSE({
              id: String(nextEventId++),
              event: event.type,
              data: event.type === "resync" ? "{}" : JSON.stringify(event.data),
            });
          });

          // Keep connection alive with periodic heartbeats
          const heartbeat = setInterval(async () => {
            await stream.writeSSE({ data: "" });
          }, 30000);

          // Keep the stream open until the client disconnects
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
