import { createRoute, z } from '@hono/zod-openapi';
import {
  DecisionContextSchema,
  DecisionTemplateSchema,
  FlaggedDecisionSchema,
  MeetingSchema,
} from '@repo/schema';

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const MeetingIdBodySchema = z.object({
  meetingId: z.string().uuid(),
}).openapi('SetActiveMeetingRequest');

const MeetingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const SetActiveDecisionRequestSchema = z.object({
  flaggedDecisionId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
}).openapi('SetActiveDecisionRequest');

const SetActiveFieldRequestSchema = z.object({
  fieldId: z.string().min(1),
}).openapi('SetActiveFieldRequest');

const GlobalContextSchema = z.object({
  activeMeetingId: z.string().uuid().optional(),
  activeDecisionId: z.string().uuid().optional(),
  activeDecisionContextId: z.string().uuid().optional(),
  activeField: z.string().optional(),
  activeMeeting: MeetingSchema.optional(),
  activeDecision: FlaggedDecisionSchema.optional(),
  activeDecisionContext: DecisionContextSchema.optional(),
  activeTemplate: DecisionTemplateSchema.optional(),
}).openapi('GlobalContext');

export const getContextRoute = createRoute({
  method: 'get',
  path: '/api/context',
  tags: ['context'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Global context returned successfully',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const setMeetingContextRoute = createRoute({
  method: 'post',
  path: '/api/context/meeting',
  tags: ['context'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: MeetingIdBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active meeting context updated successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Meeting not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const clearMeetingContextRoute = createRoute({
  method: 'delete',
  path: '/api/context/meeting',
  tags: ['context'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active meeting context cleared successfully',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const setDecisionContextRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/context/decision',
  tags: ['context'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: SetActiveDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active decision context updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Flagged decision not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const clearDecisionContextRoute = createRoute({
  method: 'delete',
  path: '/api/meetings/:id/context/decision',
  tags: ['context'],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active decision context cleared successfully',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const setFieldContextRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/context/field',
  tags: ['context'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: SetActiveFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active field context updated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context not found',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});

export const clearFieldContextRoute = createRoute({
  method: 'delete',
  path: '/api/meetings/:id/context/field',
  tags: ['context'],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: GlobalContextSchema,
        },
      },
      description: 'Active field context cleared successfully',
    },
    503: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Database-backed endpoint unavailable',
    },
  },
});
