import { createRoute, z } from '@hono/zod-openapi';
import {
  DecisionLogSchema,
  DecisionContextSchema,
  DecisionFieldSchema,
  DecisionContextWindowSchema,
  FlaggedDecisionSchema,
  FlaggedDecisionListItemSchema,
  LLMInteractionSchema,
  RawTranscriptSchema,
  SupplementaryContentSchema,
  StreamFlushResponseSchema,
  StreamStatusResponseSchema,
  StreamTranscriptEventSchema,
  StreamTranscriptResponseSchema,
  CreateSupplementaryContentSchema,
  TranscriptChunkSchema,
} from '@repo/schema';

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const GuidanceSegmentSchema = z.object({
  fieldId: z.string().optional(),
  content: z.string(),
  source: z.enum(['user_text', 'tagged_transcript']),
});

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const DecisionFieldParamSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().min(1),
});

const MeetingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const TranscriptUploadRequestSchema = z.object({
  content: z.string().min(1),
  format: z.enum(['json', 'txt', 'vtt', 'srt']).default('txt'),
  metadata: z.record(z.any()).optional(),
  uploadedBy: z.string().optional(),
  chunkStrategy: z.enum(['fixed', 'semantic', 'speaker', 'streaming']).default('fixed'),
  chunkSize: z.number().int().positive().optional(),
  overlap: z.number().int().min(0).optional(),
}).openapi('TranscriptUploadRequest');

const TranscriptUploadResponseSchema = z.object({
  transcript: RawTranscriptSchema,
  chunks: z.array(TranscriptChunkSchema),
}).openapi('TranscriptUploadResponse');

const CreateFlaggedDecisionRequestSchema = FlaggedDecisionSchema.omit({
  id: true,
  meetingId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  confidence: z.number().min(0).max(1).default(1),
  priority: z.number().int().default(0),
}).openapi('CreateFlaggedDecisionRequest');

const CreateDecisionContextRequestSchema = DecisionContextSchema.omit({
  id: true,
  lockedFields: true,
  draftVersions: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).openapi('CreateDecisionContextRequest');

const GenerateDraftRequestSchema = z.object({
  guidance: z.array(GuidanceSegmentSchema).optional(),
}).openapi('GenerateDraftRequest');

const MarkdownExportQuerySchema = z.object({
  includeMetadata: z.coerce.boolean().optional(),
  includeTimestamps: z.coerce.boolean().optional(),
  includeParticipants: z.coerce.boolean().optional(),
  fieldOrder: z.enum(['template', 'alphabetical']).optional(),
  lockedFieldIndicator: z.enum(['prefix', 'suffix', 'none']).optional(),
});

const MarkdownExportResponseSchema = z.object({
  markdown: z.string(),
}).openapi('MarkdownExportResponse');

const LockFieldRequestSchema = z.object({
  fieldId: z.string(),
}).openapi('LockFieldRequest');

const DraftVersionSummarySchema = z.object({
  version: z.number().int().positive(),
  savedAt: z.string(),
  fieldCount: z.number().int().min(0),
}).openapi('DraftVersionSummary');

const DraftVersionsResponseSchema = z.object({
  versions: z.array(DraftVersionSummarySchema),
}).openapi('DraftVersionsResponse');

const RollbackDraftRequestSchema = z.object({
  version: z.number().int().positive(),
}).openapi('RollbackDraftRequest');

const RegenerateFieldRequestSchema = z.object({
  guidance: z.array(GuidanceSegmentSchema).optional(),
}).openapi('RegenerateFieldRequest');

const RegenerateFieldResponseSchema = z.object({
  value: z.string(),
}).openapi('RegenerateFieldResponse');

const UpdateFieldValueRequestSchema = z.object({
  value: z.unknown(),
}).openapi('UpdateFieldValueRequest');

const ChangeTemplateRequestSchema = z.object({
  templateId: z.string().uuid(),
}).openapi('ChangeTemplateRequest');

const FieldTranscriptResponseSchema = z.object({
  chunks: z.array(TranscriptChunkSchema),
}).openapi('FieldTranscriptResponse');

const DecisionMethodSchema = z.object({
  type: z.enum(['consensus', 'vote', 'authority', 'defer', 'reject', 'manual', 'ai_assisted']),
  details: z.string().optional(),
});

const LogDecisionRequestSchema = z.object({
  loggedBy: z.string(),
  decisionMethod: DecisionMethodSchema,
}).openapi('LogDecisionRequest');

const DecisionExportQuerySchema = z.object({
  format: z.enum(['markdown', 'json']).default('markdown'),
});

const DecisionExportResponseSchema = z.object({
  format: z.enum(['markdown', 'json']),
  content: z.union([z.string(), z.record(z.any())]),
}).openapi('DecisionExportResponse');

const LLMInteractionsResponseSchema = z.object({
  interactions: z.array(LLMInteractionSchema),
}).openapi('LLMInteractionsResponse');

const SupplementaryContentQuerySchema = z.object({
  context: z.string().min(1),
});

const SupplementaryContentListResponseSchema = z.object({
  items: z.array(SupplementaryContentSchema),
}).openapi('SupplementaryContentListResponse');

const FlaggedDecisionStatusQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'dismissed']).optional(),
});

const FlaggedDecisionListResponseSchema = z.object({
  decisions: z.array(FlaggedDecisionListItemSchema),
}).openapi('FlaggedDecisionListResponse');

const TemplateFieldsResponseSchema = z.object({
  fields: z.array(DecisionFieldSchema),
}).openapi('TemplateFieldsResponse');

const DecisionContextWindowsResponseSchema = z.object({
  windows: z.array(DecisionContextWindowSchema),
}).openapi('DecisionContextWindowsResponse');

const DecisionContextWindowPreviewQuerySchema = z.object({
  strategy: z.enum(['all', 'recent', 'relevant', 'weighted']).default('relevant'),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const DecisionContextWindowPreviewResponseSchema = z.object({
  chunks: z.array(TranscriptChunkSchema),
  totalTokens: z.number().int().min(0),
  estimatedRelevance: z.record(z.number()),
}).openapi('DecisionContextWindowPreviewResponse');

const CreateDecisionContextWindowRequestSchema = z.object({
  selectionStrategy: z.enum(['recent', 'relevant', 'weighted']).default('relevant'),
  usedFor: z.enum(['draft', 'regenerate', 'field-specific']).default('draft'),
}).openapi('CreateDecisionContextWindowRequest');

const UpdateFlaggedDecisionRequestSchema = z.object({
  suggestedTitle: z.string().min(1).optional(),
  contextSummary: z.string().min(1).optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'dismissed']).optional(),
  priority: z.number().int().optional(),
  chunkIds: z.array(z.string().uuid()).min(1).optional(),
}).openapi('UpdateFlaggedDecisionRequest');

export const uploadTranscriptRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/transcripts/upload',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: TranscriptUploadRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: TranscriptUploadResponseSchema,
        },
      },
      description: 'Transcript uploaded and chunked successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const streamTranscriptRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/transcripts/stream',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: StreamTranscriptEventSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: StreamTranscriptResponseSchema,
        },
      },
      description: 'Transcript stream event buffered successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const getStreamingStatusRoute = createRoute({
  method: 'get',
  path: '/api/meetings/:id/streaming/status',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: StreamStatusResponseSchema,
        },
      },
      description: 'Streaming buffer status returned successfully',
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

export const flushStreamingRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/streaming/flush',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: StreamFlushResponseSchema,
        },
      },
      description: 'Streaming buffer flushed successfully',
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

export const clearStreamingBufferRoute = createRoute({
  method: 'delete',
  path: '/api/meetings/:id/streaming/buffer',
  tags: ['transcripts'],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    204: {
      description: 'Streaming buffer cleared successfully',
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

export const createSupplementaryContentRoute = createRoute({
  method: 'post',
  path: '/api/supplementary-content',
  tags: ['supplementary-content'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSupplementaryContentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SupplementaryContentSchema,
        },
      },
      description: 'Supplementary content created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const listSupplementaryContentRoute = createRoute({
  method: 'get',
  path: '/api/supplementary-content',
  tags: ['supplementary-content'],
  request: {
    query: SupplementaryContentQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SupplementaryContentListResponseSchema,
        },
      },
      description: 'Supplementary content returned successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const deleteSupplementaryContentRoute = createRoute({
  method: 'delete',
  path: '/api/supplementary-content/:id',
  tags: ['supplementary-content'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    204: {
      description: 'Supplementary content deleted successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Supplementary content not found',
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

export const createFlaggedDecisionRoute = createRoute({
  method: 'post',
  path: '/api/meetings/:id/flagged-decisions',
  tags: ['flagged-decisions'],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateFlaggedDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: FlaggedDecisionSchema,
        },
      },
      description: 'Flagged decision created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const listFlaggedDecisionsRoute = createRoute({
  method: 'get',
  path: '/api/meetings/:id/flagged-decisions',
  tags: ['flagged-decisions'],
  request: {
    params: MeetingIdParamSchema,
    query: FlaggedDecisionStatusQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FlaggedDecisionListResponseSchema,
        },
      },
      description: 'Flagged decisions returned successfully',
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

export const updateFlaggedDecisionRoute = createRoute({
  method: 'patch',
  path: '/api/flagged-decisions/:id',
  tags: ['flagged-decisions'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateFlaggedDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FlaggedDecisionSchema,
        },
      },
      description: 'Flagged decision updated successfully',
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

export const getFlaggedDecisionContextRoute = createRoute({
  method: 'get',
  path: '/api/flagged-decisions/:id/context',
  tags: ['flagged-decisions'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Decision context returned successfully',
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

export const listTemplateFieldsRoute = createRoute({
  method: 'get',
  path: '/api/templates/:id/fields',
  tags: ['templates'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TemplateFieldsResponseSchema,
        },
      },
      description: 'Ordered template fields returned successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Template not found',
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

export const createDecisionContextRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts',
  tags: ['decision-contexts'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateDecisionContextRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Decision context created successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request data',
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

export const changeDecisionContextTemplateRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/template-change',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: ChangeTemplateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Decision context template changed successfully',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context or template not found',
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

export const listDecisionContextWindowsRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/context-window',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextWindowsResponseSchema,
        },
      },
      description: 'Saved context windows returned successfully',
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

export const createDecisionContextWindowRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/context-window',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: CreateDecisionContextWindowRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: DecisionContextWindowSchema,
        },
      },
      description: 'Context window created successfully',
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

export const previewDecisionContextWindowRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/context-window/preview',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    query: DecisionContextWindowPreviewQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextWindowPreviewResponseSchema,
        },
      },
      description: 'Context window preview returned successfully',
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

export const generateDraftRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/generate-draft',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: GenerateDraftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Draft generated successfully',
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

export const exportMarkdownRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/export/markdown',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    query: MarkdownExportQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: MarkdownExportResponseSchema,
        },
      },
      description: 'Markdown export generated successfully',
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

export const lockFieldRoute = createRoute({
  method: 'put',
  path: '/api/decision-contexts/:id/lock-field',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Field locked successfully',
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

export const unlockFieldRoute = createRoute({
  method: 'delete',
  path: '/api/decision-contexts/:id/lock-field',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Field unlocked successfully',
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

export const listDraftVersionsRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/versions',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DraftVersionsResponseSchema,
        },
      },
      description: 'Saved draft versions for the decision context',
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

export const rollbackDraftRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/rollback',
  tags: ['decision-contexts'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: RollbackDraftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Draft rolled back successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid rollback request',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context or version not found',
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

export const regenerateFieldRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/fields/:fieldId/regenerate',
  tags: ['decision-contexts'],
  request: {
    params: DecisionFieldParamSchema,
    body: {
      content: {
        'application/json': {
          schema: RegenerateFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RegenerateFieldResponseSchema,
        },
      },
      description: 'Field regenerated successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid field regeneration request',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision context or field not found',
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

export const updateFieldValueRoute = createRoute({
  method: 'patch',
  path: '/api/decision-contexts/:id/fields/:fieldId',
  tags: ['decision-contexts'],
  request: {
    params: DecisionFieldParamSchema,
    body: {
      content: {
        'application/json': {
          schema: UpdateFieldValueRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionContextSchema,
        },
      },
      description: 'Field updated successfully',
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

export const getFieldTranscriptRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/fields/:fieldId/transcript',
  tags: ['decision-contexts', 'transcripts'],
  request: {
    params: DecisionFieldParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: FieldTranscriptResponseSchema,
        },
      },
      description: 'Field-tagged transcript chunks for the decision context field',
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

export const logDecisionRoute = createRoute({
  method: 'post',
  path: '/api/decision-contexts/:id/log',
  tags: ['decision-contexts', 'decisions'],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: LogDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionLogSchema,
        },
      },
      description: 'Decision logged successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid decision logging request',
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

export const getDecisionLogRoute = createRoute({
  method: 'get',
  path: '/api/decisions/:id',
  tags: ['decisions'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionLogSchema,
        },
      },
      description: 'Decision log details',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision log not found',
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

export const exportDecisionLogRoute = createRoute({
  method: 'get',
  path: '/api/decisions/:id/export',
  tags: ['decisions'],
  request: {
    params: UuidParamSchema,
    query: DecisionExportQuerySchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: DecisionExportResponseSchema,
        },
      },
      description: 'Decision log export',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Decision log not found',
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

export const listLLMInteractionsRoute = createRoute({
  method: 'get',
  path: '/api/decision-contexts/:id/llm-interactions',
  tags: ['decision-contexts', 'observability'],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LLMInteractionsResponseSchema,
        },
      },
      description: 'LLM interactions for the decision context',
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
