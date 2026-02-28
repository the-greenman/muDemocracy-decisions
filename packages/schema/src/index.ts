import { z } from '@hono/zod-openapi';

// ============================================================================
// MEETING SCHEMAS
// ============================================================================

export const MeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  date: z.string().datetime({ offset: true }),
  participants: z.array(z.string()).min(1, 'At least one participant is required'),
  status: z.enum(['active', 'completed']).default('active'),
  createdAt: z.string().datetime({ offset: true }),
}).openapi('Meeting', {
  description: 'A meeting entity',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Meeting',
    date: '2026-02-27T10:00:00Z',
    participants: ['Alice', 'Bob'],
    status: 'active',
    createdAt: '2026-02-27T10:00:00Z',
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

export const RawTranscriptSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  source: z.enum(['upload', 'stream', 'import']),
  format: z.enum(['json', 'txt', 'vtt', 'srt']),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  uploadedAt: z.string().datetime({ offset: true }),
  uploadedBy: z.string().optional(),
}).openapi('RawTranscript', {
  description: 'Raw transcript uploaded to a meeting',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    source: 'upload',
    format: 'txt',
    content: 'Meeting transcript text...',
    metadata: { fileName: 'meeting.txt' },
    uploadedAt: '2026-02-27T10:00:00Z',
    uploadedBy: 'Alice',
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

export const TranscriptChunkSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  rawTranscriptId: z.string().uuid(),
  sequenceNumber: z.number().int().nonnegative(),
  text: z.string(),
  speaker: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  chunkStrategy: z.enum(['fixed', 'semantic', 'speaker', 'streaming']),
  tokenCount: z.number().int().optional(),
  wordCount: z.number().int().optional(),
  contexts: z.array(z.string()).default([]),
  topics: z.array(z.string()).optional(),
  createdAt: z.string().datetime({ offset: true }),
}).openapi('TranscriptChunk', {
  description: 'A chunk of transcript with context tags',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440002',
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    rawTranscriptId: '550e8400-e29b-41d4-a716-446655440001',
    sequenceNumber: 0,
    text: 'We need to decide on the architecture.',
    speaker: 'Alice',
    startTime: '00:05:00',
    endTime: '00:05:10',
    chunkStrategy: 'semantic',
    tokenCount: 10,
    wordCount: 7,
    contexts: ['meeting:550e8400-e29b-41d4-a716-446655440000'],
    topics: ['architecture'],
    createdAt: '2026-02-27T10:00:00Z',
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

// ============================================================================
// CHUNK RELEVANCE SCHEMAS
// ============================================================================

export const ChunkRelevanceSchema = z.object({
  id: z.string().uuid(),
  chunkId: z.string().uuid(),
  decisionContextId: z.string().uuid(),
  fieldId: z.string().uuid(),
  relevance: z.number().min(0).max(1),
  taggedBy: z.enum(['llm', 'rule', 'manual']),
  taggedAt: z.string().datetime({ offset: true }),
}).openapi('ChunkRelevance', {
  description: 'Relevance score of a chunk to a decision field',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440003',
    chunkId: '550e8400-e29b-41d4-a716-446655440002',
    decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
    fieldId: '550e8400-e29b-41d4-a716-446655440005',
    relevance: 0.95,
    taggedBy: 'llm',
    taggedAt: '2026-02-27T10:00:00Z',
  },
});

export type ChunkRelevance = z.infer<typeof ChunkRelevanceSchema>;

// ============================================================================
// DECISION CONTEXT WINDOW SCHEMAS
// ============================================================================

export const DecisionContextWindowSchema = z.object({
  id: z.string().uuid(),
  decisionContextId: z.string().uuid(),
  chunkIds: z.array(z.string().uuid()),
  selectionStrategy: z.enum(['all', 'relevant', 'recent', 'weighted']),
  totalTokens: z.number().int(),
  totalChunks: z.number().int(),
  relevanceScores: z.record(z.number()).optional(),
  usedFor: z.enum(['draft', 'regenerate', 'field-specific']),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).openapi('DecisionContextWindow', {
  description: 'A window of transcript chunks selected for decision context',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440006',
    decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
    chunkIds: ['550e8400-e29b-41d4-a716-446655440002'],
    selectionStrategy: 'relevant',
    totalTokens: 500,
    totalChunks: 1,
    relevanceScores: { '550e8400-e29b-41d4-a716-446655440002': 0.95 },
    usedFor: 'draft',
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
});

export type DecisionContextWindow = z.infer<typeof DecisionContextWindowSchema>;

// ============================================================================
// FLAGGED DECISION SCHEMAS
// ============================================================================

export const FlaggedDecisionSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  suggestedTitle: z.string(),
  contextSummary: z.string(),
  confidence: z.number().min(0).max(1),
  chunkIds: z.array(z.string().uuid()),
  suggestedTemplateId: z.string().uuid().optional(),
  templateConfidence: z.number().min(0).max(1).optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'dismissed']).default('pending'),
  priority: z.number().int().default(0),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).openapi('FlaggedDecision', {
  description: 'A decision flagged for attention in a meeting',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440007',
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    suggestedTitle: 'Architecture Decision',
    contextSummary: 'Team discussed microservices vs monolith',
    confidence: 0.89,
    chunkIds: ['550e8400-e29b-41d4-a716-446655440002'],
    suggestedTemplateId: '550e8400-e29b-41d4-a716-446655440008',
    templateConfidence: 0.92,
    status: 'pending',
    priority: 1,
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
});

export type FlaggedDecision = z.infer<typeof FlaggedDecisionSchema>;
export type CreateFlaggedDecision = Omit<FlaggedDecision, 'id' | 'status' | 'createdAt' | 'updatedAt'>;

// ============================================================================
// DECISION CONTEXT SCHEMAS
// ============================================================================

export const DecisionContextSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  flaggedDecisionId: z.string().uuid(),
  title: z.string(),
  templateId: z.string().uuid(),
  activeField: z.string().uuid().optional(),
  lockedFields: z.array(z.string()).default([]),
  draftData: z.record(z.any()).optional(),
  status: z.enum(['drafting', 'reviewing', 'locked', 'logged']).default('drafting'),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).openapi('DecisionContext', {
  description: 'Working context for drafting a decision',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440004',
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    flaggedDecisionId: '550e8400-e29b-41d4-a716-446655440007',
    title: 'Architecture Decision',
    templateId: '550e8400-e29b-41d4-a716-446655440008',
    activeField: '550e8400-e29b-41d4-a716-446655440005',
    lockedFields: ['decision_statement'],
    draftData: { decision_statement: 'We will use microservices' },
    status: 'drafting',
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
});

export type DecisionContext = z.infer<typeof DecisionContextSchema>;

// ============================================================================
// DECISION LOG SCHEMAS
// ============================================================================

export const DecisionLogSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  decisionContextId: z.string().uuid(),
  templateId: z.string().uuid(),
  templateVersion: z.number().int(),
  fields: z.record(z.any()),
  decisionMethod: z.object({
    type: z.enum(['consensus', 'vote', 'authority', 'defer', 'reject']),
    details: z.string().optional(),
  }),
  sourceChunkIds: z.array(z.string().uuid()),
  loggedAt: z.string().datetime({ offset: true }),
  loggedBy: z.string(),
}).openapi('DecisionLog', {
  description: 'Immutable record of a logged decision',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440009',
    meetingId: '550e8400-e29b-41d4-a716-446655440000',
    decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
    templateId: '550e8400-e29b-41d4-a716-446655440008',
    templateVersion: 1,
    fields: { decision_statement: 'We will use microservices' },
    decisionMethod: { type: 'consensus', details: '5 for, 2 against' },
    sourceChunkIds: ['550e8400-e29b-41d4-a716-446655440002'],
    loggedAt: '2026-02-27T10:00:00Z',
    loggedBy: 'Alice',
  },
});

export type DecisionLog = z.infer<typeof DecisionLogSchema>;

// ============================================================================
// DECISION FIELD SCHEMAS
// ============================================================================

export const ValidationRuleSchema = z.object({
  type: z.enum(['required', 'minLength', 'maxLength', 'pattern', 'enum']),
  value: z.union([z.string(), z.number(), z.array(z.string())]).optional(),
  message: z.string().optional(),
});

export const DecisionFieldSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['context', 'evaluation', 'outcome', 'metadata']),
  extractionPrompt: z.string(),
  fieldType: z.enum(['text', 'textarea', 'select', 'multiselect', 'number', 'date', 'url']),
  placeholder: z.string().optional(),
  validationRules: z.array(ValidationRuleSchema).optional(),
  version: z.number().int().default(1),
  isCustom: z.boolean().default(false),
  createdAt: z.string().datetime({ offset: true }),
}).openapi('DecisionField', {
  description: 'A field definition for decision templates',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'decision_statement',
    description: 'The core decision being made',
    category: 'outcome',
    extractionPrompt: 'Extract the main decision statement from the discussion',
    fieldType: 'textarea',
    placeholder: 'Enter the decision...',
    validationRules: [{ type: 'required' }],
    version: 1,
    isCustom: false,
    createdAt: '2026-02-27T10:00:00Z',
  },
});

export type DecisionField = z.infer<typeof DecisionFieldSchema>;

// ============================================================================
// DECISION TEMPLATE SCHEMAS
// ============================================================================

export const TemplateFieldAssignmentSchema = z.object({
  fieldId: z.string().uuid(),
  order: z.number().int().nonnegative(),
  required: z.boolean().default(true),
  customLabel: z.string().optional(),
  customDescription: z.string().optional(),
}).openapi('TemplateFieldAssignment', {
  description: 'Assignment of a field to a template',
  example: {
    fieldId: '550e8400-e29b-41d4-a716-446655440005',
    order: 0,
    required: true,
    customLabel: 'Decision',
    customDescription: 'What are we deciding?',
  },
});

export type TemplateFieldAssignment = z.infer<typeof TemplateFieldAssignmentSchema>;

export const DecisionTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.enum(['standard', 'technology', 'strategy', 'budget', 'policy', 'proposal']),
  fields: z.array(TemplateFieldAssignmentSchema),
  version: z.number().int().default(1),
  isDefault: z.boolean().default(false),
  isCustom: z.boolean().default(false),
  createdAt: z.string().datetime({ offset: true }),
}).openapi('DecisionTemplate', {
  description: 'A template for structuring decisions',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440008',
    name: 'Technology Selection',
    description: 'Template for choosing between technical options',
    category: 'technology',
    fields: [
      {
        fieldId: '550e8400-e29b-41d4-a716-446655440005',
        order: 0,
        required: true,
        customLabel: 'Decision',
      },
    ],
    version: 1,
    isDefault: false,
    isCustom: false,
    createdAt: '2026-02-27T10:00:00Z',
  },
});

export type DecisionTemplate = z.infer<typeof DecisionTemplateSchema>;

// ============================================================================
// EXPERT TEMPLATE SCHEMAS
// ============================================================================

export const ExpertTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['technical', 'legal', 'stakeholder', 'custom']),
  promptTemplate: z.string(),
  mcpAccess: z.array(z.string()).default([]),
  outputSchema: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).openapi('ExpertTemplate', {
  description: 'Template for domain expert consultations',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440010',
    name: 'Technical Architecture Review',
    type: 'technical',
    promptTemplate: 'You are a technical architect. Review this decision...',
    mcpAccess: ['github', 'docs'],
    outputSchema: { suggestions: 'array', concerns: 'array' },
    isActive: true,
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
});

export type ExpertTemplate = z.infer<typeof ExpertTemplateSchema>;

// ============================================================================
// MCP SERVER SCHEMAS
// ============================================================================

export const MCPServerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['stdio', 'http', 'sse']),
  connectionConfig: z.record(z.any()),
  capabilities: z.object({
    tools: z.array(z.string()).optional(),
    resources: z.array(z.string()).optional(),
  }),
  status: z.enum(['active', 'inactive', 'error']).default('active'),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).openapi('MCPServer', {
  description: 'MCP server configuration',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: 'github-mcp',
    type: 'stdio',
    connectionConfig: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
    capabilities: { tools: ['search_code', 'get_file'] },
    status: 'active',
    createdAt: '2026-02-27T10:00:00Z',
    updatedAt: '2026-02-27T10:00:00Z',
  },
});

export type MCPServer = z.infer<typeof MCPServerSchema>;

// ============================================================================
// EXPERT ADVICE SCHEMAS
// ============================================================================

export const ExpertAdviceSchema = z.object({
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
}).openapi('ExpertAdvice', {
  description: 'Advice from a domain expert for a decision',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440012',
    decisionContextId: '550e8400-e29b-41d4-a716-446655440004',
    expertId: '550e8400-e29b-41d4-a716-446655440010',
    expertName: 'Technical Architecture Review',
    request: 'Review this architecture decision',
    response: {
      suggestions: ['Consider service mesh'],
      concerns: ['Latency concerns with microservices'],
      questions: ['What is the team size?'],
    },
    mcpToolsUsed: ['github'],
    requestedAt: '2026-02-27T10:00:00Z',
  },
});

export type ExpertAdvice = z.infer<typeof ExpertAdviceSchema>;

// Export all schemas
export {
  // Re-export for convenience
  z,
};
