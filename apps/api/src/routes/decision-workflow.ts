import { createRoute, z } from "@hono/zod-openapi";
import {
  DecisionLogSchema,
  DecisionContextSchema,
  DecisionTemplateSchema,
  ExportTemplateSchema,
  DecisionFieldSchema,
  DecisionFeedbackSchema,
  DecisionFeedbackListSchema,
  CreateDecisionFeedbackSchema,
  DecisionContextWindowSchema,
  AssignTranscriptChunksRequestSchema,
  AssignTranscriptChunksResponseSchema,
  ExpertTemplateSchema,
  FlaggedDecisionSchema,
  FlaggedDecisionListItemSchema,
  LLMInteractionSchema,
  MCPServerSchema,
  RawTranscriptSchema,
  SupplementaryContentSchema,
  StreamFlushResponseSchema,
  StreamStatusResponseSchema,
  StreamTranscriptEventSchema,
  StreamTranscriptResponseSchema,
  CreateSupplementaryContentSchema,
  TranscriptChunkSchema,
  ApiStatusSchema,
  UpdateDecisionContextSchema,
} from "@repo/schema";

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const DecisionFieldParamSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
});

const MeetingIdParamSchema = z.object({
  id: z.string().uuid(),
});

const FeedbackIdParamSchema = z.object({
  feedbackId: z.string().uuid(),
});

const TranscriptUploadRequestSchema = z
  .object({
    content: z.string().min(1),
    format: z.enum(["json", "txt", "vtt", "srt"]).default("txt"),
    metadata: z.record(z.any()).optional(),
    uploadedBy: z.string().optional(),
    chunkStrategy: z.enum(["fixed", "semantic", "speaker", "streaming"]).default("fixed"),
    chunkSize: z.number().int().positive().optional(),
    overlap: z.number().int().min(0).optional(),
  })
  .openapi("TranscriptUploadRequest");

const TranscriptUploadResponseSchema = z
  .object({
    transcript: RawTranscriptSchema,
    chunks: z.array(TranscriptChunkSchema),
  })
  .openapi("TranscriptUploadResponse");

const CreateFlaggedDecisionRequestSchema = FlaggedDecisionSchema.omit({
  id: true,
  meetingId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
})
  .extend({
    confidence: z.number().min(0).max(1).default(1),
    priority: z.number().int().default(0),
  })
  .openapi("CreateFlaggedDecisionRequest");

const CreateDecisionContextRequestSchema = DecisionContextSchema.omit({
  id: true,
  lockedFields: true,
  draftVersions: true,
  status: true,
  createdAt: true,
  updatedAt: true,
}).openapi("CreateDecisionContextRequest");

const GenerateDraftRequestSchema = z.object({}).openapi("GenerateDraftRequest");

const MarkdownExportQuerySchema = z.object({
  exportTemplateId: z.string().uuid().optional(),
  includeMetadata: z.coerce.boolean().optional(),
  includeTimestamps: z.coerce.boolean().optional(),
  includeParticipants: z.coerce.boolean().optional(),
  fieldOrder: z.enum(["template", "alphabetical"]).optional(),
  lockedFieldIndicator: z.enum(["prefix", "suffix", "none"]).optional(),
});

const MarkdownExportResponseSchema = z
  .object({
    markdown: z.string(),
  })
  .openapi("MarkdownExportResponse");

const LockFieldRequestSchema = z
  .object({
    fieldId: z.string().uuid(),
  })
  .openapi("LockFieldRequest");

const DraftVersionSummarySchema = z
  .object({
    version: z.number().int().positive(),
    savedAt: z.string(),
    fieldCount: z.number().int().min(0),
  })
  .openapi("DraftVersionSummary");

const DraftVersionsResponseSchema = z
  .object({
    versions: z.array(DraftVersionSummarySchema),
  })
  .openapi("DraftVersionsResponse");

const RollbackDraftRequestSchema = z
  .object({
    version: z.number().int().positive(),
  })
  .openapi("RollbackDraftRequest");

const RegenerateFieldRequestSchema = z.object({}).openapi("RegenerateFieldRequest");

const RegenerateFieldResponseSchema = z
  .object({
    value: z.string(),
  })
  .openapi("RegenerateFieldResponse");

const ToggleFeedbackExcludeRequestSchema = z
  .object({
    excludeFromRegeneration: z.boolean(),
  })
  .openapi("ToggleFeedbackExcludeRequest");

const UpdateFieldValueRequestSchema = z
  .object({
    value: z.unknown(),
  })
  .openapi("UpdateFieldValueRequest");

const ChangeTemplateRequestSchema = z
  .object({
    templateId: z.string().uuid(),
  })
  .openapi("ChangeTemplateRequest");

const FieldTranscriptResponseSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema),
  })
  .openapi("FieldTranscriptResponse");

const DecisionMethodSchema = z.object({
  type: z.enum(["consensus", "vote", "authority", "defer", "reject", "manual", "ai_assisted"]),
  details: z.string().optional(),
});

const LogDecisionRequestSchema = z
  .object({
    loggedBy: z.string(),
    decisionMethod: DecisionMethodSchema,
  })
  .openapi("LogDecisionRequest");

const DecisionExportQuerySchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
});

const DecisionExportResponseSchema = z
  .object({
    format: z.enum(["markdown", "json"]),
    content: z.union([z.string(), z.record(z.any())]),
  })
  .openapi("DecisionExportResponse");

const LLMInteractionsResponseSchema = z
  .object({
    interactions: z.array(LLMInteractionSchema),
  })
  .openapi("LLMInteractionsResponse");

const SupplementaryContentQuerySchema = z.object({
  context: z.string().min(1),
});

const SupplementaryContentListResponseSchema = z
  .object({
    items: z.array(SupplementaryContentSchema),
  })
  .openapi("SupplementaryContentListResponse");

const FlaggedDecisionStatusQuerySchema = z.object({
  status: z.enum(["pending", "accepted", "rejected", "dismissed"]).optional(),
});

const FlaggedDecisionListResponseSchema = z
  .object({
    decisions: z.array(FlaggedDecisionListItemSchema),
  })
  .openapi("FlaggedDecisionListResponse");

const DecisionTemplateListResponseSchema = z
  .object({
    templates: z.array(DecisionTemplateSchema),
  })
  .openapi("DecisionTemplateListResponse");

const ExportTemplateListResponseSchema = z
  .object({
    exportTemplates: z.array(ExportTemplateSchema),
  })
  .openapi("ExportTemplateListResponse");

const TemplateFieldsResponseSchema = z
  .object({
    fields: z.array(DecisionFieldSchema),
  })
  .openapi("TemplateFieldsResponse");

const DecisionContextWindowsResponseSchema = z
  .object({
    windows: z.array(DecisionContextWindowSchema),
  })
  .openapi("DecisionContextWindowsResponse");

const ExpertsListResponseSchema = z
  .object({
    experts: z.array(ExpertTemplateSchema),
  })
  .openapi("ExpertsListResponse");

const MCPServersListResponseSchema = z
  .object({
    servers: z.array(MCPServerSchema),
  })
  .openapi("MCPServersListResponse");

const RawTranscriptsListResponseSchema = z
  .object({
    transcripts: z.array(RawTranscriptSchema),
  })
  .openapi("RawTranscriptsListResponse");

const MeetingChunksListResponseSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema),
  })
  .openapi("MeetingChunksListResponse");

const SearchChunksRequestSchema = z
  .object({
    meetingId: z.string().uuid(),
    query: z.string().min(1),
  })
  .openapi("SearchChunksRequest");

const DecisionContextWindowPreviewQuerySchema = z.object({
  strategy: z.enum(["all", "recent", "relevant", "weighted"]).default("relevant"),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const DecisionContextWindowPreviewResponseSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema),
    totalTokens: z.number().int().min(0),
    estimatedRelevance: z.record(z.number()),
  })
  .openapi("DecisionContextWindowPreviewResponse");

const CreateDecisionContextWindowRequestSchema = z
  .object({
    selectionStrategy: z.enum(["recent", "relevant", "weighted"]).default("relevant"),
    usedFor: z.enum(["draft", "regenerate", "field-specific"]).default("draft"),
  })
  .openapi("CreateDecisionContextWindowRequest");

const UpdateFlaggedDecisionRequestSchema = z
  .object({
    suggestedTitle: z.string().min(1).optional(),
    contextSummary: z.string().min(1).optional(),
    status: z.enum(["pending", "accepted", "rejected", "dismissed"]).optional(),
    priority: z.number().int().optional(),
    chunkIds: z.array(z.string().uuid()).min(1).optional(),
  })
  .openapi("UpdateFlaggedDecisionRequest");

export const getApiStatusRoute = createRoute({
  method: "get",
  path: "/api/status",
  tags: ["system"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ApiStatusSchema,
        },
      },
      description: "API runtime status returned successfully",
    },
  },
});

export const listDecisionFeedbackRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/feedback",
  tags: ["decision-feedback"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionFeedbackListSchema,
        },
      },
      description: "Feedback list returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const listFieldDecisionFeedbackRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/feedback/field/:fieldId",
  tags: ["decision-feedback"],
  request: {
    params: DecisionFieldParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionFeedbackListSchema,
        },
      },
      description: "Field feedback list returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or field not found",
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

export const createDecisionFeedbackRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/feedback",
  tags: ["decision-feedback"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateDecisionFeedbackSchema.omit({ decisionContextId: true }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: DecisionFeedbackSchema,
        },
      },
      description: "Feedback item created successfully",
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
      description: "Decision context not found",
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

export const toggleDecisionFeedbackExcludeRoute = createRoute({
  method: "patch",
  path: "/api/decision-feedback/:feedbackId/exclude",
  tags: ["decision-feedback"],
  request: {
    params: FeedbackIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: ToggleFeedbackExcludeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionFeedbackSchema,
        },
      },
      description: "Feedback exclusion updated successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Feedback item not found",
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

export const deleteDecisionFeedbackRoute = createRoute({
  method: "delete",
  path: "/api/decision-feedback/:feedbackId",
  tags: ["decision-feedback"],
  request: {
    params: FeedbackIdParamSchema,
  },
  responses: {
    204: {
      description: "Feedback item deleted successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Feedback item not found",
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

export const uploadTranscriptRoute = createRoute({
  method: "post",
  path: "/api/meetings/:id/transcripts/upload",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: TranscriptUploadRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: TranscriptUploadResponseSchema,
        },
      },
      description: "Transcript uploaded and chunked successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid transcript upload request",
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

export const streamTranscriptRoute = createRoute({
  method: "post",
  path: "/api/meetings/:id/transcripts/stream",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: StreamTranscriptEventSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: StreamTranscriptResponseSchema,
        },
      },
      description: "Transcript stream event buffered successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid stream event",
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

export const getStreamingStatusRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/streaming/status",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StreamStatusResponseSchema,
        },
      },
      description: "Streaming buffer status returned successfully",
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

export const flushStreamingRoute = createRoute({
  method: "post",
  path: "/api/meetings/:id/streaming/flush",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: StreamFlushResponseSchema,
        },
      },
      description: "Streaming buffer flushed successfully",
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

export const clearStreamingBufferRoute = createRoute({
  method: "delete",
  path: "/api/meetings/:id/streaming/buffer",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    204: {
      description: "Streaming buffer cleared successfully",
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

export const listRawTranscriptsRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/transcripts/raw",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: RawTranscriptsListResponseSchema,
        },
      },
      description: "Raw transcripts returned successfully",
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

export const listMeetingChunksRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/chunks",
  tags: ["transcripts"],
  request: {
    params: MeetingIdParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingChunksListResponseSchema,
        },
      },
      description: "Transcript chunks returned successfully",
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

export const searchChunksRoute = createRoute({
  method: "post",
  path: "/api/chunks/search",
  tags: ["transcripts"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SearchChunksRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MeetingChunksListResponseSchema,
        },
      },
      description: "Matching transcript chunks returned successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid search request",
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

export const listExpertsRoute = createRoute({
  method: "get",
  path: "/api/experts",
  tags: ["experts"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ExpertsListResponseSchema,
        },
      },
      description: "Registered experts returned successfully",
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

export const listMCPServersRoute = createRoute({
  method: "get",
  path: "/api/mcp/servers",
  tags: ["mcp"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MCPServersListResponseSchema,
        },
      },
      description: "Registered MCP servers returned successfully",
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

export const createSupplementaryContentRoute = createRoute({
  method: "post",
  path: "/api/supplementary-content",
  tags: ["supplementary-content"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateSupplementaryContentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: SupplementaryContentSchema,
        },
      },
      description: "Supplementary content created successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid request data",
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

export const listSupplementaryContentRoute = createRoute({
  method: "get",
  path: "/api/supplementary-content",
  tags: ["supplementary-content"],
  request: {
    query: SupplementaryContentQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: SupplementaryContentListResponseSchema,
        },
      },
      description: "Supplementary content returned successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid request data",
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

export const deleteSupplementaryContentRoute = createRoute({
  method: "delete",
  path: "/api/supplementary-content/:id",
  tags: ["supplementary-content"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    204: {
      description: "Supplementary content deleted successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Supplementary content not found",
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

export const createFlaggedDecisionRoute = createRoute({
  method: "post",
  path: "/api/meetings/:id/flagged-decisions",
  tags: ["flagged-decisions"],
  request: {
    params: MeetingIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateFlaggedDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: FlaggedDecisionSchema,
        },
      },
      description: "Flagged decision created successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid request data",
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

export const listFlaggedDecisionsRoute = createRoute({
  method: "get",
  path: "/api/meetings/:id/flagged-decisions",
  tags: ["flagged-decisions"],
  request: {
    params: MeetingIdParamSchema,
    query: FlaggedDecisionStatusQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: FlaggedDecisionListResponseSchema,
        },
      },
      description: "Flagged decisions returned successfully",
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

export const updateFlaggedDecisionRoute = createRoute({
  method: "patch",
  path: "/api/flagged-decisions/:id",
  tags: ["flagged-decisions"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateFlaggedDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: FlaggedDecisionSchema,
        },
      },
      description: "Flagged decision updated successfully",
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
      description: "Flagged decision not found",
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

export const deleteFlaggedDecisionRoute = createRoute({
  method: "delete",
  path: "/api/flagged-decisions/:id",
  tags: ["flagged-decisions"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    204: {
      description: "Flagged decision deleted successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Flagged decision not found",
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

export const getFlaggedDecisionContextRoute = createRoute({
  method: "get",
  path: "/api/flagged-decisions/:id/context",
  tags: ["flagged-decisions"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Decision context returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const listTemplatesRoute = createRoute({
  method: "get",
  path: "/api/templates",
  tags: ["templates"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionTemplateListResponseSchema,
        },
      },
      description: "Decision templates returned successfully",
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

export const listTemplateFieldsRoute = createRoute({
  method: "get",
  path: "/api/templates/:id/fields",
  tags: ["templates"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: TemplateFieldsResponseSchema,
        },
      },
      description: "Ordered template fields returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Template not found",
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

export const listTemplateExportTemplatesRoute = createRoute({
  method: "get",
  path: "/api/templates/:id/export-templates",
  tags: ["templates"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: ExportTemplateListResponseSchema,
        },
      },
      description: "Export templates returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Template not found",
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

export const createDecisionContextRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts",
  tags: ["decision-contexts"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateDecisionContextRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Decision context created successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid request data",
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

export const getDecisionContextRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Decision context retrieved successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const updateDecisionContextRoute = createRoute({
  method: "patch",
  path: "/api/decision-contexts/:id",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateDecisionContextSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Decision context updated successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const changeDecisionContextTemplateRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/template-change",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: ChangeTemplateRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Decision context template changed successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or template not found",
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

export const listDecisionContextWindowsRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/context-window",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextWindowsResponseSchema,
        },
      },
      description: "Saved context windows returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const createDecisionContextWindowRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/context-window",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: CreateDecisionContextWindowRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: DecisionContextWindowSchema,
        },
      },
      description: "Context window created successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const previewDecisionContextWindowRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/context-window/preview",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    query: DecisionContextWindowPreviewQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextWindowPreviewResponseSchema,
        },
      },
      description: "Context window preview returned successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const generateDraftRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/generate-draft",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: GenerateDraftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Draft generated successfully",
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
      description: "Decision context not found",
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

export const regenerateDraftRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/regenerate",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: z.object({}).openapi("RegenerateDraftRequest"),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Draft regenerated successfully",
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
      description: "Decision context not found",
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

export const exportMarkdownRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/export/markdown",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    query: MarkdownExportQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: MarkdownExportResponseSchema,
        },
      },
      description: "Markdown export generated successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const lockFieldRoute = createRoute({
  method: "put",
  path: "/api/decision-contexts/:id/lock-field",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Field locked successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const unlockFieldRoute = createRoute({
  method: "delete",
  path: "/api/decision-contexts/:id/lock-field",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: LockFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Field unlocked successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const listDraftVersionsRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/versions",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DraftVersionsResponseSchema,
        },
      },
      description: "Saved draft versions for the decision context",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const rollbackDraftRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/rollback",
  tags: ["decision-contexts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: RollbackDraftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Draft rolled back successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid rollback request or unavailable draft version",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or version not found",
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

export const regenerateFieldRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/fields/:fieldId/regenerate",
  tags: ["decision-contexts"],
  request: {
    params: DecisionFieldParamSchema,
    body: {
      content: {
        "application/json": {
          schema: RegenerateFieldRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: RegenerateFieldResponseSchema,
        },
      },
      description: "Field regenerated successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid regenerate request or field cannot be regenerated",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or field not found",
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

export const updateFieldValueRoute = createRoute({
  method: "patch",
  path: "/api/decision-contexts/:id/fields/:fieldId",
  tags: ["decision-contexts"],
  request: {
    params: DecisionFieldParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateFieldValueRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionContextSchema,
        },
      },
      description: "Field updated successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid field update request",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const getFieldTranscriptRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/fields/:fieldId/transcript",
  tags: ["decision-contexts", "transcripts"],
  request: {
    params: DecisionFieldParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: FieldTranscriptResponseSchema,
        },
      },
      description: "Field-tagged transcript chunks for the decision context field",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid field transcript request",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or field not found",
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

export const assignDecisionTranscriptContextRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/transcript/context",
  tags: ["decision-contexts", "transcripts"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: AssignTranscriptChunksRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AssignTranscriptChunksResponseSchema,
        },
      },
      description: "Transcript chunks tagged for the decision context",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid transcript context assignment request",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const assignFieldTranscriptContextRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/fields/:fieldId/transcript/context",
  tags: ["decision-contexts", "transcripts"],
  request: {
    params: DecisionFieldParamSchema,
    body: {
      content: {
        "application/json": {
          schema: AssignTranscriptChunksRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AssignTranscriptChunksResponseSchema,
        },
      },
      description: "Transcript chunks tagged for the decision field",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid field transcript context assignment request",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context or field not found",
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

export const logDecisionRoute = createRoute({
  method: "post",
  path: "/api/decision-contexts/:id/log",
  tags: ["decision-contexts", "decisions"],
  request: {
    params: UuidParamSchema,
    body: {
      content: {
        "application/json": {
          schema: LogDecisionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionLogSchema,
        },
      },
      description: "Decision logged successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Invalid decision logging request",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision context not found",
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

export const getDecisionLogRoute = createRoute({
  method: "get",
  path: "/api/decisions/:id",
  tags: ["decisions"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionLogSchema,
        },
      },
      description: "Decision log details",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision log not found",
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

export const exportDecisionLogRoute = createRoute({
  method: "get",
  path: "/api/decisions/:id/export",
  tags: ["decisions"],
  request: {
    params: UuidParamSchema,
    query: DecisionExportQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: DecisionExportResponseSchema,
        },
      },
      description: "Decision log export",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Decision log not found",
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

export const listLLMInteractionsRoute = createRoute({
  method: "get",
  path: "/api/decision-contexts/:id/llm-interactions",
  tags: ["decision-contexts", "observability"],
  request: {
    params: UuidParamSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: LLMInteractionsResponseSchema,
        },
      },
      description: "LLM interactions for the decision context",
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
