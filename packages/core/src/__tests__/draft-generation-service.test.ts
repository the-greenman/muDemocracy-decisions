import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DraftGenerationService } from '../services/draft-generation-service';
import { MockLLMService } from '../llm/mock-llm-service';
import type { DecisionContext, DecisionField, TranscriptChunk, TemplateFieldAssignment } from '@repo/schema';
import type { ITranscriptChunkRepository } from '../interfaces/transcript-repositories';
import type { ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository';
import type { IDecisionContextRepository } from '../interfaces/i-decision-context-repository';
import type { IDecisionFieldRepository } from '../interfaces/i-decision-field-repository';
import type { ILLMInteractionRepository } from '../interfaces/i-llm-interaction-repository';
import type { IFlaggedDecisionRepository } from '../interfaces/i-flagged-decision-repository';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeField(id: string, name: string): DecisionField {
  return {
    id,
    namespace: 'core',
    name,
    description: `Description for ${name}`,
    category: 'outcome',
    extractionPrompt: `Extract ${name}`,
    fieldType: 'textarea',
    version: 1,
    isCustom: false,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeAssignment(fieldId: string, order: number): TemplateFieldAssignment {
  return {
    fieldId,
    order,
    required: true,
  };
}

function makeChunk(id: string, contexts: string[] = []): TranscriptChunk {
  return {
    id,
    meetingId: 'meeting-1',
    rawTranscriptId: 'raw-1',
    sequenceNumber: 0,
    text: `Chunk ${id}`,
    chunkStrategy: 'semantic',
    contexts: ['meeting:meeting-1', ...contexts],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    id: 'ctx-1',
    meetingId: 'meeting-1',
    flaggedDecisionId: 'flag-1',
    title: 'Test Decision',
    templateId: 'template-1',
    status: 'drafting',
    lockedFields: [],
    draftData: {},
    draftVersions: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Mock factories ────────────────────────────────────────────────────────────

function makeRepos(context: DecisionContext, chunks: TranscriptChunk[], fields: DecisionField[]) {
  const assignments = fields.map((f, i) => makeAssignment(f.id, i));

  const contextRepo: IDecisionContextRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(context),
    findByMeetingId: vi.fn(),
    findByFlaggedDecisionId: vi.fn(),
    update: vi.fn().mockImplementation((_id, data) =>
      Promise.resolve({ ...context, ...data })
    ),
    lockField: vi.fn(),
    unlockField: vi.fn(),
    lockAllFields: vi.fn(),
    setActiveField: vi.fn(),
    updateStatus: vi.fn(),
  };

  const transcriptRepo: ITranscriptChunkRepository = {
    create: vi.fn(),
    findByMeetingId: vi.fn().mockResolvedValue(chunks),
    findByContext: vi.fn(),
    findById: vi.fn(),
    search: vi.fn(),
    findByDecisionContext: vi.fn(),
  };

  const fieldAssignmentRepo: ITemplateFieldAssignmentRepository = {
    create: vi.fn(),
    findByTemplateId: vi.fn().mockResolvedValue(assignments),
    findByFieldId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByTemplateId: vi.fn(),
    createMany: vi.fn(),
    updateOrder: vi.fn(),
  };

  const fieldRepo: IDecisionFieldRepository = {
    create: vi.fn(),
    findById: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(fields.find(f => f.id === id) ?? null)
    ),
    findAll: vi.fn(),
    findByCategory: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
    search: vi.fn(),
    findByType: vi.fn(),
  };

  const llmInteractionRepo: ILLMInteractionRepository = {
    create: vi.fn().mockResolvedValue({ id: 'interaction-1' }),
    findByDecisionContext: vi.fn(),
    findByField: vi.fn(),
  };

  const flaggedDecisionRepo: IFlaggedDecisionRepository = {
    create: vi.fn(),
    findByMeetingId: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: 'flag-1',
      meetingId: 'meeting-1',
      suggestedTitle: 'Flagged Decision',
      contextSummary: 'Flagged decision summary',
      confidence: 0.9,
      chunkIds: ['chunk-1'],
      status: 'pending',
      priority: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    update: vi.fn(),
    updatePriority: vi.fn(),
    updateStatus: vi.fn(),
  };

  return { contextRepo, transcriptRepo, fieldAssignmentRepo, fieldRepo, llmInteractionRepo, flaggedDecisionRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DraftGenerationService', () => {
  const fields = [
    makeField('field-statement', 'decision_statement'),
    makeField('field-options', 'options'),
  ];

  const chunks = [makeChunk('chunk-1'), makeChunk('chunk-2')];

  let llm: MockLLMService;
  let service: DraftGenerationService;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(() => {
    llm = new MockLLMService({
      draftResponse: {
        'field-statement': 'Approve cloud migration',
        'field-options': 'AWS, Azure, GCP',
      },
    });
    repos = makeRepos(makeContext(), chunks, fields);
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );
  });

  it('generates draft and persists result', async () => {
    const result = await service.generateDraft('ctx-1');

    expect(result).toBeDefined();
    expect(repos.contextRepo.update).toHaveBeenCalledWith(
      'ctx-1',
      expect.objectContaining({
        draftData: expect.objectContaining({
          'field-statement': 'Approve cloud migration',
        }),
      })
    );
  });

  it('stores an LLM interaction record', async () => {
    await service.generateDraft('ctx-1');

    expect(repos.llmInteractionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionContextId: 'ctx-1',
        operation: 'generate_draft',
        fieldId: null,
        promptSegments: expect.any(Array),
        promptText: expect.any(String),
      })
    );
  });

  it('saves a draft snapshot before overwriting existing draft data', async () => {
    repos = makeRepos(
      makeContext({ draftData: { 'field-statement': 'Previous decision' } }),
      chunks,
      fields,
    );
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );

    await service.generateDraft('ctx-1');

    expect(repos.contextRepo.update).toHaveBeenNthCalledWith(
      1,
      'ctx-1',
      expect.objectContaining({
        draftVersions: [
          expect.objectContaining({
            version: 1,
            draftData: { 'field-statement': 'Previous decision' },
          }),
        ],
      }),
    );
  });

  it('does not regenerate locked fields', async () => {
    const contextWithLock = makeContext({ lockedFields: ['field-statement'] });
    repos = makeRepos(contextWithLock, chunks, fields);
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );

    await service.generateDraft('ctx-1');

    // The update should NOT include the locked field being overwritten
    const updateCall = vi.mocked(repos.contextRepo.update).mock.calls[0];
    expect(updateCall).toBeDefined();
    const updatedDraft = updateCall![1].draftData as Record<string, string>;
    // field-statement was locked so it should not be in the updatedDraft from LLM
    // (it comes from existing draftData which is empty {} in makeContext default)
    expect(updatedDraft['field-statement']).toBeUndefined();
    expect(updatedDraft['field-options']).toBe('AWS, Azure, GCP');
  });

  it('returns context unchanged when all fields are locked', async () => {
    const allLocked = makeContext({ lockedFields: ['field-statement', 'field-options'] });
    repos = makeRepos(allLocked, chunks, fields);
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );

    const result = await service.generateDraft('ctx-1');

    expect(repos.llmInteractionRepo.create).not.toHaveBeenCalled();
    expect(repos.contextRepo.update).not.toHaveBeenCalled();
    expect(result).toEqual(allLocked);
  });

  it('throws when context not found', async () => {
    vi.mocked(repos.contextRepo.findById).mockResolvedValue(null);

    await expect(service.generateDraft('nonexistent')).rejects.toThrow('Decision context not found');
  });

  it('regenerateField stores interaction with fieldId', async () => {
    llm.setFieldResponse('field-options', 'AWS, Azure');

    await service.regenerateField('ctx-1', 'field-options');

    expect(repos.llmInteractionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        decisionContextId: 'ctx-1',
        fieldId: 'field-options',
        operation: 'regenerate_field',
      })
    );
  });

  it('regenerateField prioritizes field-tagged chunks over decision-tagged and meeting-tagged chunks', async () => {
    const weightedChunks = [
      makeChunk('meeting-only', []),
      makeChunk('decision-tagged', ['decision:ctx-1']),
      makeChunk('field-tagged', ['decision:ctx-1:field-options']),
    ];
    repos = makeRepos(makeContext(), weightedChunks, fields);
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );

    const llmSpy = vi.spyOn(llm, 'regenerateField');

    await service.regenerateField('ctx-1', 'field-options');

    const transcriptChunks = llmSpy.mock.calls[0]?.[0].transcriptChunks;
    expect(transcriptChunks?.map((chunk) => chunk.id)).toEqual([
      'field-tagged',
      'decision-tagged',
      'meeting-only',
    ]);
  });

  it('regenerateField throws when persistence fails after LLM completion', async () => {
    llm.setFieldResponse('field-options', 'AWS, Azure');
    vi.mocked(repos.contextRepo.update).mockResolvedValue(null);

    await expect(service.regenerateField('ctx-1', 'field-options')).rejects.toThrow(
      'Failed to persist regenerated field field-options for context: ctx-1'
    );
  });

  it('regenerateField throws when field is locked', async () => {
    const lockedCtx = makeContext({ lockedFields: ['field-options'] });
    repos = makeRepos(lockedCtx, chunks, fields);
    service = new DraftGenerationService(
      llm,
      repos.transcriptRepo,
      repos.fieldAssignmentRepo,
      repos.fieldRepo,
      repos.contextRepo,
      repos.llmInteractionRepo,
      repos.flaggedDecisionRepo,
    );

    await expect(service.regenerateField('ctx-1', 'field-options'))
      .rejects.toThrow('Field field-options is locked');
  });

  it('passes guidance segments to LLM', async () => {
    const llmSpy = vi.spyOn(llm, 'generateDraft');
    const guidance = [{ content: 'Focus on cost', source: 'user_text' as const }];

    await service.generateDraft('ctx-1', guidance);

    expect(llmSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        guidance: expect.arrayContaining([
          expect.objectContaining({ content: 'Focus on cost' }),
        ]),
      })
    );
  });

  it('stores the same full-draft prompt shape sent to the llm', async () => {
    const guidance = [
      { content: 'Focus on cost', source: 'user_text' as const },
      { fieldId: 'field-options', content: 'Only for options', source: 'user_text' as const },
    ];

    await service.generateDraft('ctx-1', guidance);

    const createCall = vi.mocked(repos.llmInteractionRepo.create).mock.calls[0];
    expect(createCall).toBeDefined();

    const record = createCall![0];
    expect(record.promptText).toContain('You are an expert at analyzing meeting transcripts');
    expect(record.promptText).toContain('=== GUIDANCE ===');
    expect(record.promptText).toContain('Focus on cost');
    expect(record.promptText).not.toContain('Only for options');
  });

  it('stores the same field-regeneration prompt shape sent to the llm', async () => {
    const guidance = [
      { content: 'General context', source: 'user_text' as const },
      { fieldId: 'field-options', content: 'Only for options', source: 'user_text' as const },
      { fieldId: 'field-statement', content: 'Wrong field', source: 'user_text' as const },
    ];

    await service.regenerateField('ctx-1', 'field-options', guidance);

    const createCall = vi.mocked(repos.llmInteractionRepo.create).mock.calls[0];
    expect(createCall).toBeDefined();

    const record = createCall![0];
    expect(record.promptText).toContain('You are an expert at analyzing meeting transcripts');
    expect(record.promptText).toContain('General context');
    expect(record.promptText).toContain('Only for options');
    expect(record.promptText).not.toContain('Wrong field');
  });
});
