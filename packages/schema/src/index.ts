import { z } from "@hono/zod-openapi";
export { z } from "@hono/zod-openapi";

// ============================================================================
// MEETING SCHEMAS
// ============================================================================

export const MeetingStatusSchema = z.enum(["proposed", "in_session", "ended"]);

export const MeetingSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1, "Title is required"),
    date: z.string().datetime({ offset: true }),
    participants: z.array(z.string()).min(1, "At least one participant is required"),
    status: MeetingStatusSchema.default("proposed"),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("Meeting", {
    description: "A meeting entity",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Meeting",
      date: "2026-02-27T10:00:00Z",
      participants: ["Alice", "Bob"],
      status: "proposed",
      createdAt: "2026-02-27T10:00:00Z",
    },
  });

export type Meeting = z.infer<typeof MeetingSchema>;

export const CreateMeetingSchema = MeetingSchema.pick({
  title: true,
  date: true,
  participants: true,
}).extend({
  date: z.string().datetime({ offset: true }),
});

export type CreateMeeting = z.infer<typeof CreateMeetingSchema>;

export const UpdateMeetingSchema = MeetingSchema.pick({
  title: true,
  status: true,
}).partial();

export type UpdateMeeting = z.infer<typeof UpdateMeetingSchema>;

// ============================================================================
// TRANSCRIPT SCHEMAS
// ============================================================================

export const RawTranscriptSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    source: z.enum(["upload", "stream", "import"]),
    format: z.enum(["json", "txt", "vtt", "srt"]),
    content: z.string(),
    metadata: z.record(z.any()).optional(),
    uploadedAt: z.string().datetime({ offset: true }),
    uploadedBy: z.string().optional(),
  })
  .openapi("RawTranscript", {
    description: "Raw transcript uploaded to a meeting",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440001",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      source: "upload",
      format: "txt",
      content: "Meeting transcript text...",
      metadata: { fileName: "meeting.txt" },
      uploadedAt: "2026-02-27T10:00:00Z",
      uploadedBy: "Alice",
    },
  });

export type RawTranscript = z.infer<typeof RawTranscriptSchema>;

export const CreateRawTranscriptSchema = RawTranscriptSchema.pick({
  meetingId: true,
  source: true,
  format: true,
  content: true,
  metadata: true,
  uploadedBy: true,
});

export type CreateRawTranscript = z.infer<typeof CreateRawTranscriptSchema>;

export const ReadableTranscriptRowSchema = z
  .object({
    id: z.string(),
    meetingId: z.string().uuid(),
    rawTranscriptId: z.string().uuid(),
    rawTranscriptUploadedAt: z.string().datetime({ offset: true }),
    rawTranscriptFormat: z.enum(["json", "txt", "vtt", "srt"]),
    sequenceNumber: z.number().int().positive(),
    displayText: z.string(),
    chunkIds: z.array(z.string().uuid()).default([]),
    speaker: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    sourceMetadata: z.record(z.unknown()).optional(),
  })
  .openapi("ReadableTranscriptRow", {
    description:
      "A readable transcript row derived from normalized preprocessing output for human review and selection",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440100:1",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      rawTranscriptId: "550e8400-e29b-41d4-a716-446655440001",
      rawTranscriptUploadedAt: "2026-02-27T10:00:00Z",
      rawTranscriptFormat: "txt",
      sequenceNumber: 1,
      displayText: "We should keep the system simple and evolve it over time.",
      chunkIds: ["550e8400-e29b-41d4-a716-446655440002"],
      speaker: "Alice",
      startTime: "00:08:29",
      endTime: "00:08:35",
      sourceMetadata: { sourceBlockIndex: 0 },
    },
  });

export type ReadableTranscriptRow = z.infer<typeof ReadableTranscriptRowSchema>;

export const TranscriptChunkSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    rawTranscriptId: z.string().uuid(),
    sequenceNumber: z.number().int().nonnegative(),
    text: z.string(),
    speaker: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    chunkStrategy: z.enum(["fixed", "semantic", "speaker", "streaming"]),
    tokenCount: z.number().int().optional(),
    wordCount: z.number().int().optional(),
    contexts: z.array(z.string()).default([]),
    topics: z.array(z.string()).optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("TranscriptChunk", {
    description: "A chunk of transcript with context tags",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440002",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      rawTranscriptId: "550e8400-e29b-41d4-a716-446655440001",
      sequenceNumber: 0,
      text: "We need to decide on the architecture.",
      speaker: "Alice",
      startTime: "00:05:00",
      endTime: "00:05:10",
      chunkStrategy: "semantic",
      tokenCount: 10,
      wordCount: 7,
      contexts: ["meeting:550e8400-e29b-41d4-a716-446655440000"],
      topics: ["architecture"],
      createdAt: "2026-02-27T10:00:00Z",
    },
  });

export type TranscriptChunk = z.infer<typeof TranscriptChunkSchema>;

export const CreateTranscriptChunkSchema = TranscriptChunkSchema.pick({
  meetingId: true,
  rawTranscriptId: true,
  sequenceNumber: true,
  text: true,
  speaker: true,
  startTime: true,
  endTime: true,
  chunkStrategy: true,
  tokenCount: true,
  wordCount: true,
  contexts: true,
  topics: true,
});

export type CreateTranscriptChunk = z.infer<typeof CreateTranscriptChunkSchema>;

export const StreamTranscriptEventSchema = z
  .object({
    text: z.string().min(1),
    speaker: z.string().optional(),
    timestamp: z.string().optional(),
    sequenceNumber: z.number().int().positive().optional(),
    contexts: z.array(z.string().min(1)).optional(),
  })
  .openapi("StreamTranscriptEvent", {
    description: "A streaming transcript text event submitted during an active meeting",
    example: {
      text: "We decided to defer the vendor selection",
      speaker: "Alice",
      timestamp: "00:12:33",
      contexts: ["custom:note"],
    },
  });

export const StreamTranscriptResponseSchema = z
  .object({
    buffering: z.boolean(),
    bufferSize: z.number().int().min(0),
    chunkId: z.string().uuid().optional(),
    appliedContexts: z.array(z.string()),
  })
  .openapi("StreamTranscriptResponse", {
    description: "Acknowledgement that a streaming transcript event was buffered",
    example: {
      buffering: true,
      bufferSize: 2,
      appliedContexts: ["meeting:550e8400-e29b-41d4-a716-446655440000"],
    },
  });

export const StreamStatusResponseSchema = z
  .object({
    status: z.enum(["active", "idle", "flushing"]),
    eventCount: z.number().int().min(0),
  })
  .openapi("StreamStatusResponse", {
    description: "Current streaming buffer status for a meeting",
    example: {
      status: "active",
      eventCount: 3,
    },
  });

export const StreamFlushResponseSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema),
  })
  .openapi("StreamFlushResponse", {
    description: "Transcript chunks created by flushing the streaming buffer",
  });

const TranscriptionPositiveMsSchema = z.number().int().positive();

export const TranscriptionSessionCreateRequestSchema = z
  .object({
    meetingId: z.string().min(1, "meetingId is required"),
    language: z.string().min(1).optional(),
    windowMs: TranscriptionPositiveMsSchema.default(30_000),
    stepMs: TranscriptionPositiveMsSchema.default(10_000),
    dedupeHorizonMs: TranscriptionPositiveMsSchema.default(90_000),
  })
  .superRefine((value, ctx) => {
    if (value.stepMs > value.windowMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stepMs"],
        message: "stepMs must be less than or equal to windowMs",
      });
    }
  })
  .openapi("TranscriptionSessionCreateRequest", {
    description: "Start a browser-controlled transcription session",
    example: {
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      language: "en",
      windowMs: 30_000,
      stepMs: 10_000,
      dedupeHorizonMs: 90_000,
    },
  });

export type TranscriptionSessionCreateRequest = z.infer<
  typeof TranscriptionSessionCreateRequestSchema
>;

export const TranscriptionSessionCreateResponseSchema = z
  .object({
    sessionId: z.string().uuid(),
    meetingId: z.string().min(1),
    startedAt: z.string().datetime({ offset: true }),
    windowMs: TranscriptionPositiveMsSchema,
    stepMs: TranscriptionPositiveMsSchema,
    dedupeHorizonMs: TranscriptionPositiveMsSchema,
  })
  .openapi("TranscriptionSessionCreateResponse", {
    description: "Created transcription session details including effective window settings",
  });

export type TranscriptionSessionCreateResponse = z.infer<
  typeof TranscriptionSessionCreateResponseSchema
>;

export const TranscriptionSessionStatusResponseSchema = z
  .object({
    status: z.enum(["active", "stopping", "stopped"]),
    bufferedEvents: z.number().int().min(0),
    postedEvents: z.number().int().min(0),
    dedupedEvents: z.number().int().min(0),
    windowMs: TranscriptionPositiveMsSchema,
    stepMs: TranscriptionPositiveMsSchema,
    dedupeHorizonMs: TranscriptionPositiveMsSchema,
    lastChunkReceivedAt: z.string().datetime().optional(),
    lastTranscriptionAt: z.string().datetime().optional(),
    lastProviderEventCount: z.number().int().min(0).optional(),
    lastProviderTextPreview: z.string().optional(),
    lastProviderError: z.string().optional(),
  })
  .openapi("TranscriptionSessionStatusResponse", {
    description: "Runtime status for a browser transcription session",
  });

export type TranscriptionSessionStatusResponse = z.infer<
  typeof TranscriptionSessionStatusResponseSchema
>;

const TranscriptionDiagnosticTranscriptEventSchema = z.object({
  text: z.string(),
  speaker: z.string().optional(),
  startTimeSeconds: z.number().optional(),
  endTimeSeconds: z.number().optional(),
  sequenceNumber: z.number().int().optional(),
});

const TranscriptionDiagnosticChunkSchema = z.object({
  receivedAt: z.string().datetime({ offset: true }),
  filename: z.string().min(1),
  contentType: z.string().optional(),
  originalByteLength: z.number().int().min(0),
  normalizedByteLength: z.number().int().min(0),
  rollingWindowChunkCount: z.number().int().min(0),
  rollingWindowAudioBytes: z.number().int().min(0),
});

const TranscriptionDiagnosticActiveWindowChunkSchema = z.object({
  receivedAt: z.string().datetime({ offset: true }),
  filename: z.string().min(1),
  normalizedByteLength: z.number().int().min(0),
});

const TranscriptionDiagnosticWhisperResponseSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  filename: z.string().min(1),
  eventCount: z.number().int().min(0),
  textPreview: z.string(),
  rawResponse: z.unknown(),
  error: z.string().optional(),
});

const TranscriptionDiagnosticDeliveredEventSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  meetingId: z.string().min(1),
  event: TranscriptionDiagnosticTranscriptEventSchema,
});

export const TranscriptionSessionDiagnosticsSchema = z
  .object({
    sessionId: z.string().uuid(),
    meetingId: z.string().min(1),
    status: z.enum(["active", "stopping", "stopped"]),
    startedAt: z.string().datetime({ offset: true }),
    stoppedAt: z.string().datetime({ offset: true }).optional(),
    windowMs: TranscriptionPositiveMsSchema,
    stepMs: TranscriptionPositiveMsSchema,
    dedupeHorizonMs: TranscriptionPositiveMsSchema,
    bufferedEvents: z.number().int().min(0),
    postedEvents: z.number().int().min(0),
    dedupedEvents: z.number().int().min(0),
    lastChunkReceivedAt: z.string().datetime({ offset: true }).optional(),
    lastTranscriptionAt: z.string().datetime({ offset: true }).optional(),
    lastProviderEventCount: z.number().int().min(0).optional(),
    lastProviderTextPreview: z.string().optional(),
    lastProviderError: z.string().optional(),
    activeWindowChunks: z.array(TranscriptionDiagnosticActiveWindowChunkSchema),
    chunkTrace: z.array(TranscriptionDiagnosticChunkSchema),
    whisperResponses: z.array(TranscriptionDiagnosticWhisperResponseSchema),
    deliveredEvents: z.array(TranscriptionDiagnosticDeliveredEventSchema),
  })
  .openapi("TranscriptionSessionDiagnostics", {
    description: "Detailed in-memory diagnostics for a transcription session",
  });

export type TranscriptionSessionDiagnostics = z.infer<typeof TranscriptionSessionDiagnosticsSchema>;

export const TranscriptionDiagnosticsResponseSchema = z
  .object({
    status: z.literal("ok"),
    sessions: z.array(TranscriptionSessionDiagnosticsSchema),
  })
  .openapi("TranscriptionDiagnosticsResponse", {
    description: "Detailed diagnostics snapshot for all in-memory transcription sessions",
  });

export type TranscriptionDiagnosticsResponse = z.infer<typeof TranscriptionDiagnosticsResponseSchema>;

const TranscriptionHealthProbeSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const TranscriptionServiceStatusSchema = z
  .object({
    status: z.literal("ok"),
    provider: z.string(),
    api: TranscriptionHealthProbeSchema.extend({
      url: z.string(),
    }),
    whisper: z.union([
      z.object({ enabled: z.literal(false) }),
      TranscriptionHealthProbeSchema.extend({
        enabled: z.literal(true),
        url: z.string(),
      }),
    ]),
    sessionCount: z.number().int().min(0),
    defaults: z.object({
      windowMs: TranscriptionPositiveMsSchema,
      stepMs: TranscriptionPositiveMsSchema,
      dedupeHorizonMs: TranscriptionPositiveMsSchema,
      autoFlushMs: TranscriptionPositiveMsSchema,
    }),
  })
  .openapi("TranscriptionServiceStatus", {
    description: "Status for transcription service health and runtime defaults",
  });

export type TranscriptionServiceStatus = z.infer<typeof TranscriptionServiceStatusSchema>;

export const AssignTranscriptChunksRequestSchema = z
  .object({
    chunkIds: z.array(z.string().uuid()).min(1),
  })
  .openapi("AssignTranscriptChunksRequest", {
    description: "Chunk IDs to tag with transcript context derived from the route scope",
    example: {
      chunkIds: ["550e8400-e29b-41d4-a716-446655440002", "550e8400-e29b-41d4-a716-446655440003"],
    },
  });

export type AssignTranscriptChunksRequest = z.infer<typeof AssignTranscriptChunksRequestSchema>;

export const AssignTranscriptChunksResponseSchema = z
  .object({
    chunks: z.array(TranscriptChunkSchema),
  })
  .openapi("AssignTranscriptChunksResponse", {
    description: "Transcript chunks after assigning context tags",
  });

export type AssignTranscriptChunksResponse = z.infer<typeof AssignTranscriptChunksResponseSchema>;

export const ApiStatusLlmSchema = z
  .object({
    mode: z.enum(["mock", "real"]),
    provider: z.string(),
    model: z.string(),
  })
  .openapi("ApiStatusLlm", {
    description: "Safe LLM runtime configuration currently active in the API process",
    example: {
      mode: "real",
      provider: "anthropic",
      model: "claude-opus-4-5",
    },
  });

export const ApiStatusSchema = z
  .object({
    status: z.literal("ok"),
    timestamp: z.string().datetime({ offset: true }),
    nodeEnv: z.string(),
    databaseConfigured: z.boolean(),
    llm: ApiStatusLlmSchema,
  })
  .openapi("ApiStatus", {
    description: "Safe runtime diagnostics for the API process",
    example: {
      status: "ok",
      timestamp: "2026-03-10T22:30:00Z",
      nodeEnv: "development",
      databaseConfigured: true,
      llm: {
        mode: "real",
        provider: "anthropic",
        model: "claude-opus-4-5",
      },
    },
  });

// ============================================================================
// SUPPLEMENTARY CONTENT SCHEMAS
// ============================================================================

export const SupplementaryContentSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    label: z.string().optional(),
    body: z.string().min(1, "Body is required"),
    sourceType: z.string().default("manual"),
    contexts: z.array(z.string()).default([]),
    createdBy: z.string().optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("SupplementaryContent", {
    description: "Supplementary evidence attached to a meeting, decision context, or field scope",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440003",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      label: "Options comparison table",
      body: "Option 1: cloud-native stack (£45k). Option 2: patch existing service (£8k).",
      sourceType: "manual",
      contexts: ["decision:550e8400-e29b-41d4-a716-446655440004:options"],
      createdBy: "Alice",
      createdAt: "2026-02-27T10:00:00Z",
    },
  });

export type SupplementaryContent = z.infer<typeof SupplementaryContentSchema>;

export const CreateSupplementaryContentSchema = SupplementaryContentSchema.omit({
  id: true,
  createdAt: true,
}).openapi("CreateSupplementaryContent", {
  description: "Schema for creating supplementary evidence",
  example: {
    meetingId: "550e8400-e29b-41d4-a716-446655440000",
    label: "Options comparison table",
    body: "Option 1: cloud-native stack (£45k). Option 2: patch existing service (£8k).",
    sourceType: "manual",
    contexts: ["decision:550e8400-e29b-41d4-a716-446655440004:options"],
    createdBy: "Alice",
  },
});

export type CreateSupplementaryContent = z.infer<typeof CreateSupplementaryContentSchema>;

// ============================================================================
// CHUNK RELEVANCE SCHEMAS
// ============================================================================

export const ChunkRelevanceSchema = z
  .object({
    id: z.string().uuid(),
    chunkId: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    fieldId: z.string().uuid(),
    relevance: z.number().min(0).max(1),
    taggedBy: z.enum(["llm", "rule", "manual"]),
    taggedAt: z.string().datetime({ offset: true }),
  })
  .openapi("ChunkRelevance", {
    description: "Relevance score of a chunk to a decision field",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440003",
      chunkId: "550e8400-e29b-41d4-a716-446655440002",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      relevance: 0.95,
      taggedBy: "llm",
      taggedAt: "2026-02-27T10:00:00Z",
    },
  });

export type ChunkRelevance = z.infer<typeof ChunkRelevanceSchema>;

// ============================================================================
// DECISION CONTEXT WINDOW SCHEMAS
// ============================================================================

export const DecisionContextWindowSchema = z
  .object({
    id: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    chunkIds: z.array(z.string().uuid()),
    selectionStrategy: z.enum(["all", "relevant", "recent", "weighted"]),
    totalTokens: z.number().int(),
    totalChunks: z.number().int(),
    relevanceScores: z.record(z.number()).optional(),
    usedFor: z.enum(["draft", "regenerate", "field-specific"]),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .openapi("DecisionContextWindow", {
    description: "A window of transcript chunks selected for decision context",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440006",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      chunkIds: ["550e8400-e29b-41d4-a716-446655440002"],
      selectionStrategy: "relevant",
      totalTokens: 500,
      totalChunks: 1,
      relevanceScores: { "550e8400-e29b-41d4-a716-446655440002": 0.95 },
      usedFor: "draft",
      createdAt: "2026-02-27T10:00:00Z",
      updatedAt: "2026-02-27T10:00:00Z",
    },
  });

export type DecisionContextWindow = z.infer<typeof DecisionContextWindowSchema>;

// ============================================================================
// FLAGGED DECISION SCHEMAS
// ============================================================================

export const FlaggedDecisionSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    suggestedTitle: z.string(),
    contextSummary: z.string(),
    confidence: z.number().min(0).max(1),
    chunkIds: z.array(z.string().uuid()),
    suggestedTemplateId: z.string().uuid().optional(),
    templateConfidence: z.number().min(0).max(1).optional(),
    status: z.enum(["pending", "accepted", "rejected", "dismissed"]).default("pending"),
    priority: z.number().int().default(0),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .openapi("FlaggedDecision", {
    description: "A decision flagged for attention in a meeting",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440007",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      suggestedTitle: "Architecture Decision",
      contextSummary: "Team discussed microservices vs monolith",
      confidence: 0.89,
      chunkIds: ["550e8400-e29b-41d4-a716-446655440002"],
      suggestedTemplateId: "550e8400-e29b-41d4-a716-446655440008",
      templateConfidence: 0.92,
      status: "pending",
      priority: 1,
      createdAt: "2026-02-27T10:00:00Z",
      updatedAt: "2026-02-27T10:00:00Z",
    },
  });

export type FlaggedDecision = z.infer<typeof FlaggedDecisionSchema>;
export type CreateFlaggedDecision = Omit<
  FlaggedDecision,
  "id" | "status" | "createdAt" | "updatedAt"
>;

export const FlaggedDecisionListItemSchema = FlaggedDecisionSchema.extend({
  contextId: z.string().uuid().nullable(),
  contextStatus: z.enum(["drafting", "reviewing", "locked", "logged"]).nullable(),
  hasDraft: z.boolean(),
  draftFieldCount: z.number().int().min(0),
  versionCount: z.number().int().min(0),
}).openapi("FlaggedDecisionListItem", {
  description:
    "A flagged decision enriched with decision-context and draft summary for meeting queue views",
  example: {
    id: "550e8400-e29b-41d4-a716-446655440007",
    meetingId: "550e8400-e29b-41d4-a716-446655440000",
    suggestedTitle: "Architecture Decision",
    contextSummary: "Team discussed microservices vs monolith",
    confidence: 0.89,
    chunkIds: ["550e8400-e29b-41d4-a716-446655440002"],
    suggestedTemplateId: "550e8400-e29b-41d4-a716-446655440008",
    templateConfidence: 0.92,
    status: "accepted",
    priority: 1,
    createdAt: "2026-02-27T10:00:00Z",
    updatedAt: "2026-02-27T10:05:00Z",
    contextId: "550e8400-e29b-41d4-a716-446655440004",
    contextStatus: "drafting",
    hasDraft: true,
    draftFieldCount: 3,
    versionCount: 1,
  },
});

export type FlaggedDecisionListItem = z.infer<typeof FlaggedDecisionListItemSchema>;

// ============================================================================
// DECISION CONTEXT SCHEMAS
// ============================================================================

export const DraftVersionSchema = z.object({
  version: z.number().int().positive(),
  draftData: z.record(z.any()),
  savedAt: z.string().datetime({ offset: true }),
});

export type DraftVersion = z.infer<typeof DraftVersionSchema>;

export const DecisionContextSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    flaggedDecisionId: z.string().uuid(),
    title: z.string(),
    templateId: z.string().uuid(),
    activeField: z.string().uuid().optional(),
    lockedFields: z.array(z.string().uuid()).default([]),
    draftData: z.record(z.any()).optional(),
    draftVersions: z.array(DraftVersionSchema).default([]),
    suggestedTags: z.array(z.string()).optional(),
    status: z.enum(["drafting", "reviewing", "locked", "logged"]).default("drafting"),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .openapi("DecisionContext", {
    description: "Working context for drafting a decision",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440004",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      flaggedDecisionId: "550e8400-e29b-41d4-a716-446655440007",
      title: "Architecture Decision",
      templateId: "550e8400-e29b-41d4-a716-446655440008",
      activeField: "550e8400-e29b-41d4-a716-446655440005",
      lockedFields: ["550e8400-e29b-41d4-a716-446655440005"],
      draftData: { "550e8400-e29b-41d4-a716-446655440005": "We will use microservices" },
      draftVersions: [
        {
          version: 1,
          draftData: { "550e8400-e29b-41d4-a716-446655440005": "We will use a modular monolith" },
          savedAt: "2026-02-27T09:45:00Z",
        },
      ],
      status: "drafting",
      createdAt: "2026-02-27T10:00:00Z",
      updatedAt: "2026-02-27T10:00:00Z",
    },
  });

export type DecisionContext = z.infer<typeof DecisionContextSchema>;

// For creation, omit auto-generated fields and defaults
export type CreateDecisionContext = Omit<
  DecisionContext,
  "id" | "status" | "lockedFields" | "draftVersions" | "createdAt" | "updatedAt"
>;

export const UpdateDecisionContextSchema = z
  .object({
    title: z.string().min(1).optional(),
    templateId: z.string().uuid().optional(),
  })
  .openapi("UpdateDecisionContextRequest", {
    description: "Fields that can be updated on an existing decision context",
    example: { title: "Updated decision title" },
  });

export type UpdateDecisionContext = z.infer<typeof UpdateDecisionContextSchema>;

// ============================================================================
// DECISION LOG SCHEMAS
// ============================================================================

export const DecisionLogSchema = z
  .object({
    id: z.string().uuid(),
    meetingId: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    templateId: z.string().uuid(),
    templateVersion: z.number().int(),
    fields: z.record(z.any()),
    decisionMethod: z.object({
      type: z.enum(["consensus", "vote", "authority", "defer", "reject", "manual", "ai_assisted"]),
      details: z.string().optional(),
    }),
    sourceChunkIds: z.array(z.string().uuid()),
    loggedAt: z.string().datetime({ offset: true }),
    loggedBy: z.string(),
  })
  .openapi("DecisionLog", {
    description: "Immutable record of a logged decision",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440009",
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      templateId: "550e8400-e29b-41d4-a716-446655440008",
      templateVersion: 1,
      fields: { decision_statement: "We will use microservices" },
      decisionMethod: { type: "consensus", details: "5 for, 2 against" },
      sourceChunkIds: ["550e8400-e29b-41d4-a716-446655440002"],
      loggedAt: "2026-02-27T10:00:00Z",
      loggedBy: "Alice",
    },
  });

export type DecisionLog = z.infer<typeof DecisionLogSchema>;

export type CreateDecisionLog = Omit<DecisionLog, "id" | "loggedAt">;

// ============================================================================
// DECISION FIELD SCHEMAS
// ============================================================================

export const ValidationRuleSchema = z.object({
  type: z.enum(["required", "minLength", "maxLength", "pattern", "enum"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  message: z.string().optional(),
});

export const DecisionFieldSchema = z
  .object({
    id: z.string().uuid(),
    namespace: z.string().default("core"),
    name: z.string(),
    description: z.string(),
    category: z.enum(["context", "evaluation", "outcome", "metadata"]),
    extractionPrompt: z.string(),
    instructions: z.string().optional(),
    fieldType: z.enum(["text", "textarea", "select", "multiselect", "number", "date", "url"]),
    placeholder: z.string().optional(),
    validationRules: z.array(ValidationRuleSchema).optional(),
    version: z.number().int().default(1),
    isCustom: z.boolean().default(false),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("DecisionField", {
    description: "A field definition for decision templates",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440005",
      namespace: "core",
      name: "decision_statement",
      description: "The core decision being made",
      category: "outcome",
      extractionPrompt: "Extract the main decision statement from the discussion",
      fieldType: "textarea",
      placeholder: "Enter the decision statement...",
      validationRules: [
        { type: "required", message: "Decision statement is required" },
        { type: "minLength", value: 10, message: "Decision must be at least 10 characters" },
      ],
      version: 1,
      isCustom: false,
      createdAt: "2024-01-15T10:30:00Z",
    },
  });

export type DecisionField = z.infer<typeof DecisionFieldSchema>;

export const CreateDecisionFieldSchema = DecisionFieldSchema.omit({
  id: true,
  version: true,
  isCustom: true,
  createdAt: true,
}).openapi("CreateDecisionField", {
  description: "Schema for creating a new decision field",
  example: {
    namespace: "core",
    name: "decision_statement",
    description: "The core decision being made",
    category: "outcome",
    extractionPrompt: "Extract the main decision statement from the discussion",
    fieldType: "textarea",
    placeholder: "Enter the decision statement...",
    validationRules: [
      { type: "required", message: "Decision statement is required" },
      { type: "minLength", value: 10, message: "Decision must be at least 10 characters" },
    ],
  },
});

export type CreateDecisionField = z.infer<typeof CreateDecisionFieldSchema>;

// ============================================================================
// DECISION TEMPLATE SCHEMAS
// ============================================================================

export const TemplateFieldAssignmentSchema = z
  .object({
    id: z.string().uuid().optional(),
    templateId: z.string().uuid().optional(),
    fieldId: z.string().uuid(),
    order: z.number().int().nonnegative(),
    required: z.boolean().default(true),
  })
  .openapi("TemplateFieldAssignment", {
    description: "Assignment of a field to a template",
    example: {
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      order: 0,
      required: true,
    },
  });

export type TemplateFieldAssignment = z.infer<typeof TemplateFieldAssignmentSchema>;

export const CreateTemplateFieldAssignmentSchema = TemplateFieldAssignmentSchema.omit({}).openapi(
  "CreateTemplateFieldAssignment",
  {
    description: "Schema for creating a new template field assignment",
    example: {
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      order: 0,
      required: true,
    },
  },
);

export type CreateTemplateFieldAssignment = z.infer<typeof CreateTemplateFieldAssignmentSchema>;

export const DecisionTemplateSchema = z
  .object({
    id: z.string().uuid(),
    namespace: z.string().default("core"),
    name: z.string(),
    description: z.string(),
    promptTemplate: z.string().optional(),
    category: z.enum(["standard", "technology", "strategy", "budget", "policy", "proposal"]),
    fields: z.array(TemplateFieldAssignmentSchema),
    version: z.number().int().default(1),
    isDefault: z.boolean().default(false),
    isCustom: z.boolean().default(false),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("DecisionTemplate", {
    description: "A template for structuring decisions",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440008",
      namespace: "core",
      name: "Technology Selection",
      description: "Template for choosing between technical options",
      category: "technology",
      fields: [
        {
          fieldId: "550e8400-e29b-41d4-a716-446655440005",
          order: 0,
          required: true,
        },
      ],
      version: 1,
      isDefault: false,
      isCustom: false,
      createdAt: "2026-02-27T10:00:00Z",
    },
  });

export type DecisionTemplate = z.infer<typeof DecisionTemplateSchema>;

export const GlobalContextSchema = z
  .object({
    activeMeetingId: z.string().uuid().optional(),
    activeDecisionId: z.string().uuid().optional(),
    activeDecisionContextId: z.string().uuid().optional(),
    activeField: z.string().uuid().optional(),
    activeMeeting: MeetingSchema.optional(),
    activeDecision: FlaggedDecisionSchema.optional(),
    activeDecisionContext: DecisionContextSchema.optional(),
    activeTemplate: DecisionTemplateSchema.optional(),
  })
  .openapi("GlobalContext", {
    description: "Current globally selected meeting and decision drafting context",
  });

export type GlobalContext = z.infer<typeof GlobalContextSchema>;

export const InSessionMeetingsContextSummarySchema = z
  .object({
    currentContext: GlobalContextSchema,
    inSessionMeetings: z.array(MeetingSchema),
  })
  .openapi("InSessionMeetingsContextSummary", {
    description: "Current global context and all meetings whose lifecycle status is in_session",
  });

export type InSessionMeetingsContextSummary = z.infer<typeof InSessionMeetingsContextSummarySchema>;

export const CreateDecisionTemplateSchema = DecisionTemplateSchema.omit({
  id: true,
  version: true,
  isDefault: true,
  isCustom: true,
  createdAt: true,
}).openapi("CreateDecisionTemplate", {
  description: "Schema for creating a new decision template",
  example: {
    namespace: "core",
    name: "Technology Selection",
    description: "Template for choosing between technical options",
    category: "technology",
    fields: [
      {
        fieldId: "550e8400-e29b-41d4-a716-446655440005",
        order: 0,
        required: true,
      },
    ],
  },
});

export type CreateDecisionTemplate = z.infer<typeof CreateDecisionTemplateSchema>;

// ============================================================================
// EXPERT TEMPLATE SCHEMAS
// ============================================================================

export const ExpertTemplateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(["technical", "legal", "stakeholder", "custom"]),
    promptTemplate: z.string(),
    mcpAccess: z.array(z.string()).default([]),
    outputSchema: z.record(z.any()).optional(),
    isActive: z.boolean().default(true),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .openapi("ExpertTemplate", {
    description: "Template for domain expert consultations",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440010",
      name: "Technical Architecture Review",
      type: "technical",
      promptTemplate: "You are a technical architect. Review this decision...",
      mcpAccess: ["github", "docs"],
      outputSchema: { suggestions: "array", concerns: "array" },
      isActive: true,
      createdAt: "2026-02-27T10:00:00Z",
      updatedAt: "2026-02-27T10:00:00Z",
    },
  });

// For backward compatibility, add displayName as computed field
export const ExpertTemplateWithDisplaySchema = ExpertTemplateSchema.transform((data) => ({
  ...data,
  displayName: data.name, // Use name as displayName
  description: undefined, // Not stored in DB
}));

export type ExpertTemplate = z.infer<typeof ExpertTemplateSchema>;

// ============================================================================
// MCP SERVER SCHEMAS
// ============================================================================

export const MCPServerSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    type: z.enum(["stdio", "http", "sse"]),
    connectionConfig: z.record(z.any()),
    capabilities: z
      .object({
        tools: z.array(z.string()).optional(),
        resources: z.array(z.string()).optional(),
      })
      .optional(),
    status: z.enum(["active", "inactive", "error"]).default("active"),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .openapi("MCPServer", {
    description: "MCP server configuration",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440011",
      name: "github-mcp",
      type: "stdio",
      connectionConfig: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
      capabilities: { tools: ["search_code", "get_file"] },
      status: "active",
      createdAt: "2026-02-27T10:00:00Z",
      updatedAt: "2026-02-27T10:00:00Z",
    },
  });

// For backward compatibility, add description and connection fields
export const MCPServerWithCompatSchema = MCPServerSchema.transform((data) => ({
  ...data,
  description: undefined, // Not stored in DB
  connection: data.connectionConfig, // Map connectionConfig to connection
}));

export type MCPServer = z.infer<typeof MCPServerSchema>;

// ============================================================================
// EXPERT ADVICE SCHEMAS
// ============================================================================

export const ExpertAdviceSchema = z
  .object({
    id: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    expertId: z.string().uuid(),
    expertName: z.string(),
    request: z.string(),
    response: z.object({
      suggestions: z.array(z.string()),
      concerns: z.array(z.string()).optional(),
      questions: z.array(z.string()).optional(),
    }),
    mcpToolsUsed: z.array(z.string()).optional(),
    requestedAt: z.string().datetime({ offset: true }),
  })
  .openapi("ExpertAdvice", {
    description: "Advice from a domain expert for a decision",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440012",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      expertId: "550e8400-e29b-41d4-a716-446655440010",
      expertName: "Technical Architecture Review",
      request: "Review this architecture decision",
      response: {
        suggestions: ["Consider service mesh"],
        concerns: ["Latency concerns with microservices"],
        questions: ["What is the team size?"],
      },
      mcpToolsUsed: ["github"],
      requestedAt: "2026-02-27T10:00:00Z",
    },
  });

// For backward compatibility, map fields to expected names
export const ExpertAdviceWithCompatSchema = ExpertAdviceSchema.transform((data) => ({
  ...data,
  advice: data.response, // Map response to advice
  confidence: undefined, // Not stored in DB
  reasoning: undefined, // Not stored in DB
  createdAt: data.requestedAt, // Map requestedAt to createdAt
}));

export type ExpertAdvice = z.infer<typeof ExpertAdviceSchema>;

// CREATE AND UPDATE SCHEMAS
// ============================================================================

// Expert Template Create/Update
export const CreateExpertTemplateSchema = ExpertTemplateSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).openapi("CreateExpertTemplate", {
  description: "Schema for creating a new expert template",
  example: {
    name: "Technical Architecture Review",
    type: "technical",
    promptTemplate: "You are a technical architect...",
    mcpAccess: ["github", "docs"],
  },
});

export const UpdateExpertTemplateSchema = CreateExpertTemplateSchema.partial().openapi(
  "UpdateExpertTemplate",
  {
    description: "Schema for updating an expert template",
  },
);

export type CreateExpertTemplate = z.infer<typeof CreateExpertTemplateSchema>;
export type UpdateExpertTemplate = z.infer<typeof UpdateExpertTemplateSchema>;

// MCP Server Create/Update
export const CreateMCPServerSchema = MCPServerSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).openapi("CreateMCPServer", {
  description: "Schema for creating a new MCP server",
  example: {
    name: "github-mcp",
    type: "stdio",
    connectionConfig: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
    capabilities: { tools: ["search_code", "get_file"] },
  },
});

// For backward compatibility, accept connection field instead of connectionConfig
export const CreateMCPServerWithCompatSchema = CreateMCPServerSchema.transform((data) => {
  if ("connection" in data && !("connectionConfig" in data)) {
    const { connection, ...rest } = data as any;
    return {
      ...rest,
      connectionConfig: connection,
    };
  }
  return data;
});

export const UpdateMCPServerSchema = CreateMCPServerSchema.partial().openapi("UpdateMCPServer", {
  description: "Schema for updating an MCP server",
});

export type CreateMCPServer = z.infer<typeof CreateMCPServerSchema>;
export type UpdateMCPServer = z.infer<typeof UpdateMCPServerSchema>;

// Expert Advice Create
export const CreateExpertAdviceSchema = ExpertAdviceSchema.omit({
  id: true,
  requestedAt: true,
}).openapi("CreateExpertAdvice", {
  description: "Schema for creating expert advice",
  example: {
    decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
    expertId: "550e8400-e29b-41d4-a716-446655440010",
    expertName: "Technical Architecture Review",
    request: "Review this architecture decision",
    response: {
      suggestions: ["Consider service mesh"],
      concerns: ["Latency concerns"],
    },
  },
});

// For backward compatibility, accept advice field instead of response
export const CreateExpertAdviceWithCompatSchema = CreateExpertAdviceSchema.transform((data) => {
  if ("advice" in data && !("response" in data)) {
    const { advice, ...rest } = data as any;
    return {
      ...rest,
      response: advice,
    };
  }
  return data;
});

export type CreateExpertAdvice = z.infer<typeof CreateExpertAdviceSchema>;

// ============================================================================
// LLM INTERACTION SCHEMAS
// ============================================================================

export const FeedbackRatingSchema = z.enum(["approved", "needs_work", "rejected"]);

export type FeedbackRating = z.infer<typeof FeedbackRatingSchema>;

export const FeedbackSourceSchema = z.enum(["user", "expert_agent", "peer_user"]);

export type FeedbackSource = z.infer<typeof FeedbackSourceSchema>;

export const DecisionFeedbackSchema = z
  .object({
    id: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    fieldId: z.string().uuid().nullable(),
    draftVersionNumber: z.number().int().positive().nullable(),
    fieldVersionId: z.string().uuid().nullable(),
    rating: FeedbackRatingSchema,
    source: FeedbackSourceSchema,
    authorId: z.string().min(1),
    comment: z.string(),
    textReference: z.string().nullable(),
    referenceId: z.string().nullable(),
    referenceUrl: z.string().url().nullable(),
    excludeFromRegeneration: z.boolean().default(false),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("DecisionFeedback", {
    description: "Structured feedback linked to a decision context and optionally a specific field",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440111",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      fieldId: "550e8400-e29b-41d4-a716-446655440005",
      draftVersionNumber: 2,
      fieldVersionId: null,
      rating: "needs_work",
      source: "expert_agent",
      authorId: "TechReviewer",
      comment: "The options field is missing the managed service alternative.",
      textReference: "We can either self-host or use a managed offering.",
      referenceId: null,
      referenceUrl: null,
      excludeFromRegeneration: false,
      createdAt: "2026-03-12T11:00:00Z",
    },
  });

export type DecisionFeedback = z.infer<typeof DecisionFeedbackSchema>;

export const CreateDecisionFeedbackSchema = DecisionFeedbackSchema.omit({
  id: true,
  createdAt: true,
}).openapi("CreateDecisionFeedback", {
  description: "Schema for creating a feedback item",
});

export type CreateDecisionFeedback = z.infer<typeof CreateDecisionFeedbackSchema>;

export const UpdateDecisionFeedbackSchema = CreateDecisionFeedbackSchema.partial().openapi(
  "UpdateDecisionFeedback",
  {
    description: "Schema for updating a feedback item",
  },
);

export type UpdateDecisionFeedback = z.infer<typeof UpdateDecisionFeedbackSchema>;

export const DecisionFeedbackListSchema = z
  .object({
    items: z.array(DecisionFeedbackSchema),
  })
  .openapi("DecisionFeedbackList", {
    description: "A list of decision feedback items",
  });

export type DecisionFeedbackList = z.infer<typeof DecisionFeedbackListSchema>;

export const PromptSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("system"), content: z.string() }),
  z.object({
    type: z.literal("transcript"),
    speaker: z.string().optional(),
    text: z.string(),
    tags: z.array(z.string()),
  }),
  z.object({
    type: z.literal("supplementary"),
    label: z.string().optional(),
    content: z.string(),
    tags: z.array(z.string()),
  }),
  z.object({
    type: z.literal("template_guidance"),
    scope: z.enum(["template", "field"]),
    templateId: z.string().uuid(),
    fieldId: z.string().uuid().nullable(),
    label: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("feedback"),
    id: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    fieldId: z.string().uuid().nullable(),
    draftVersionNumber: z.number().int().positive().nullable(),
    fieldVersionId: z.string().uuid().nullable(),
    rating: FeedbackRatingSchema,
    source: FeedbackSourceSchema,
    authorId: z.string().min(1),
    comment: z.string(),
    textReference: z.string().nullable(),
    referenceId: z.string().nullable(),
    referenceUrl: z.string().url().nullable(),
    excludeFromRegeneration: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    type: z.literal("template_fields"),
    fields: z.array(
      z.object({
        id: z.string().uuid(),
        displayName: z.string(),
        description: z.string(),
        extractionPrompt: z.string(),
      }),
    ),
  }),
]);

export type PromptSegmentData = z.infer<typeof PromptSegmentSchema>;

export const LLMInteractionSchema = z
  .object({
    id: z.string().uuid(),
    decisionContextId: z.string().uuid(),
    fieldId: z.string().uuid().nullable(),
    operation: z.enum(["generate_draft", "regenerate_field"]),
    promptSegments: z.array(PromptSegmentSchema),
    promptText: z.string(),
    responseText: z.string(),
    parsedResult: z.record(z.string(), z.any()).nullable(),
    provider: z.string(),
    model: z.string(),
    latencyMs: z.number().int(),
    tokenCount: z.object({ input: z.number().int(), output: z.number().int() }).nullable(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .openapi("LLMInteraction", {
    description: "A stored record of an LLM API call with full prompt and response",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440099",
      decisionContextId: "550e8400-e29b-41d4-a716-446655440004",
      fieldId: null,
      operation: "generate_draft",
      promptSegments: [{ type: "system", content: "You are an expert..." }],
      promptText: "You are an expert...\n\n=== TRANSCRIPT ===\n...",
      responseText: '{"decision_statement": "Approve cloud migration"}',
      parsedResult: { decision_statement: "Approve cloud migration" },
      provider: "anthropic",
      model: "claude-opus-4-5",
      latencyMs: 1234,
      tokenCount: { input: 500, output: 50 },
      createdAt: "2026-01-01T00:00:00Z",
    },
  });

export type LLMInteraction = z.infer<typeof LLMInteractionSchema>;

// ============================================================================
// MEETING SUMMARY SCHEMA
// ============================================================================

export const MeetingSummarySchema = z
  .object({
    meetingId: z.string().uuid(),
    title: z.string(),
    segmentCount: z.number().int(),
    decisionCount: z.number().int(),
    draftCount: z.number().int(),
    loggedCount: z.number().int(),
  })
  .openapi("MeetingSummary", {
    description: "Aggregate statistics for a meeting",
    example: {
      meetingId: "550e8400-e29b-41d4-a716-446655440000",
      title: "Q1 Planning",
      segmentCount: 45,
      decisionCount: 3,
      draftCount: 2,
      loggedCount: 1,
    },
  });

export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;

// ============================================================================
// DECISION CONTEXT LIST SCHEMA
// ============================================================================

export const DecisionContextListSchema = z
  .object({
    contexts: z.array(DecisionContextSchema),
  })
  .openapi("DecisionContextList", {
    description: "List of decision contexts for a meeting",
  });

export type DecisionContextList = z.infer<typeof DecisionContextListSchema>;

export const CreateLLMInteractionSchema = LLMInteractionSchema.omit({
  id: true,
  createdAt: true,
});

export type CreateLLMInteraction = z.infer<typeof CreateLLMInteractionSchema>;
