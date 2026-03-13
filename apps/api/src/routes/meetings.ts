import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateMeetingSchema,
  DecisionContextSchema,
  MeetingStatusSchema,
  MeetingSchema,
  ReadableTranscriptRowSchema,
} from "@repo/schema";

// Extend schemas with OpenAPI metadata
const CreateMeetingRequestSchema = CreateMeetingSchema.openapi({
  example: {
    title: "Test Meeting",
    date: "2026-02-27T10:00:00Z",
    participants: ["Alice", "Bob"],
  },
});

const MeetingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const UpdateMeetingRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    date: z.string().datetime({ offset: true }).optional(),
    participants: z.array(z.string()).min(1).optional(),
    status: MeetingStatusSchema.optional(),
  })
  .openapi("UpdateMeetingRequest");

const MeetingSummaryResponseSchema = z
  .object({
    decisionCount: z.number().int().min(0),
    draftCount: z.number().int().min(0),
    loggedCount: z.number().int().min(0),
  })
  .openapi("MeetingSummaryResponse");

const MeetingDecisionContextsResponseSchema = z
  .object({
    contexts: z.array(DecisionContextSchema),
  })
  .openapi("MeetingDecisionContextsResponse");

const TranscriptReadingResponseSchema = z
  .object({
    rows: z.array(ReadableTranscriptRowSchema),
  })
  .openapi("TranscriptReadingResponse");

const MeetingResponseSchema = MeetingSchema.openapi({
  example: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Test Meeting",
    date: "2026-02-27T10:00:00Z",
    participants: ["Alice", "Bob"],
    status: "proposed",
    createdAt: "2026-02-27T10:00:00Z",
  },
});

export const getMeetingTranscriptReadingRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/transcript-reading",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TranscriptReadingResponseSchema,
        },
      },
      description: "Readable transcript rows returned successfully",
    },
    503: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Database-backed endpoint unavailable",
    },
  },
});

// POST /api/meetings route
export const createMeetingRoute = createRoute({
  method: "post",
  path: "/api/meetings",
  tags: ["meetings"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateMeetingRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: MeetingResponseSchema,
        },
      },
      description: "Meeting created successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Invalid request data",
    },
  },
});

// GET /api/meetings route
export const listMeetingsRoute = createRoute({
  method: "get",
  path: "/api/meetings",
  tags: ["meetings"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            meetings: z.array(MeetingResponseSchema),
          }),
        },
      },
      description: "List of meetings",
    },
  },
});

// GET /api/meetings/:id route
export const getMeetingRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingResponseSchema,
        },
      },
      description: "Meeting details",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Meeting not found",
    },
  },
});

export const updateMeetingRoute = createRoute({
  method: "patch",
  path: "/api/meetings/:id",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateMeetingRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingResponseSchema,
        },
      },
      description: "Meeting updated successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid request data",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Meeting not found",
    },
    409: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Meeting cannot be deleted because dependent records still exist",
    },
  },
});

export const deleteMeetingRoute = createRoute({
  method: "delete",
  path: "/api/meetings/:id",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    204: {
      description: "Meeting deleted successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Meeting not found",
    },
    409: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Meeting cannot be deleted because dependent records still exist",
    },
  },
});

export const getMeetingSummaryRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/summary",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingSummaryResponseSchema,
        },
      },
      description: "Meeting summary returned successfully",
    },
    503: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Database-backed endpoint unavailable",
    },
  },
});

export const listMeetingDecisionContextsRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/decision-contexts",
  tags: ["meetings"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingDecisionContextsResponseSchema,
        },
      },
      description: "Meeting decision contexts returned successfully",
    },
    503: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Database-backed endpoint unavailable",
    },
  },
});
