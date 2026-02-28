import { createRoute, z } from '@hono/zod-openapi';
import { CreateMeetingSchema, MeetingSchema } from '@repo/schema';

// Extend schemas with OpenAPI metadata
const CreateMeetingRequestSchema = CreateMeetingSchema.openapi({
  example: {
    title: 'Test Meeting',
    date: '2026-02-27T10:00:00Z',
    participants: ['Alice', 'Bob'],
  },
});

const MeetingResponseSchema = MeetingSchema.openapi({
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Meeting',
    date: '2026-02-27T10:00:00Z',
    participants: ['Alice', 'Bob'],
    status: 'active',
    createdAt: '2026-02-27T10:00:00Z',
  },
});

// POST /api/meetings route
export const createMeetingRoute = createRoute({
  method: 'post',
  path: '/api/meetings',
  tags: ['meetings'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateMeetingRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: MeetingResponseSchema,
        },
      },
      description: 'Meeting created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Invalid request data',
    },
  },
});

// GET /api/meetings route
export const listMeetingsRoute = createRoute({
  method: 'get',
  path: '/api/meetings',
  tags: ['meetings'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            meetings: z.array(MeetingResponseSchema),
          }),
        },
      },
      description: 'List of meetings',
    },
  },
});

// GET /api/meetings/:id route
export const getMeetingRoute = createRoute({
  method: 'get',
  path: '/api/meetings/:id',
  tags: ['meetings'],
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MeetingResponseSchema,
        },
      },
      description: 'Meeting details',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Meeting not found',
    },
  },
});
