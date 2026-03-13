import { describe, it, expect } from 'vitest';
import {
  buildDraftPrompt,
  buildFieldRegenerationPrompt,
  buildDraftPromptFromTemplate,
  PromptBuilder,
} from './prompt-builder.js';
import type { DecisionField, TranscriptChunk } from '@repo/schema';

const makeField = (overrides: Partial<DecisionField> = {}): DecisionField => ({
  id: 'field-1',
  namespace: 'core',
  name: 'decision_statement',
  description: 'A clear statement of the decision',
  category: 'outcome',
  extractionPrompt: 'Extract a single sentence stating the decision. Use active voice.',
  fieldType: 'textarea',
  version: 2,
  isCustom: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const makeChunk = (overrides: Partial<TranscriptChunk> = {}): TranscriptChunk => ({
  id: 'chunk-1',
  meetingId: 'meeting-1',
  rawTranscriptId: 'raw-1',
  sequenceNumber: 1,
  text: 'We decided to use managed object storage.',
  startTime: '00:00:00',
  endTime: '00:00:05',
  chunkStrategy: 'fixed',
  contexts: ['meeting:meeting-1'],
  createdAt: new Date().toISOString(),
  ...overrides,
});

// ============================================================================
// PromptBuilder unit tests
// ============================================================================

describe('PromptBuilder', () => {
  it('includes extractionPrompt in serialized template_fields', () => {
    const builder = new PromptBuilder();
    builder.addTemplateFields([makeField()]);
    const text = builder.buildString();

    expect(text).toContain('Extract a single sentence stating the decision. Use active voice.');
  });

  it('renders field name, description, and extractionPrompt in the fields section', () => {
    const builder = new PromptBuilder();
    builder.addTemplateFields([
      makeField({ name: 'decision_statement', description: 'Core decision', extractionPrompt: 'Extract the decision.' }),
    ]);
    const text = builder.buildString();

    expect(text).toContain('decision_statement');
    expect(text).toContain('Core decision');
    expect(text).toContain('Extract the decision.');
  });

  it('includes extractionPrompt in built segments', () => {
    const builder = new PromptBuilder();
    builder.addTemplateFields([makeField()]);
    const segments = builder.buildSegments();
    const fieldSeg = segments.find((s) => s.type === 'template_fields');
    expect(fieldSeg).toBeDefined();
    if (fieldSeg?.type === 'template_fields') {
      expect(fieldSeg.fields[0]?.extractionPrompt).toBe(
        'Extract a single sentence stating the decision. Use active voice.',
      );
    }
  });
});

// ============================================================================
// buildDraftPrompt
// ============================================================================

describe('buildDraftPrompt', () => {
  it('includes templatePrompt in system context when provided', () => {
    const templatePrompt = 'This is a Technology Selection decision. Focus on trade-offs.';
    const { text } = buildDraftPrompt(
      [makeChunk()],
      [],
      'template-1',
      [makeField()],
      [],
      undefined,
      templatePrompt,
    );

    expect(text).toContain('This is a Technology Selection decision. Focus on trade-offs.');
  });

  it('does not break when templatePrompt is not provided', () => {
    const { text } = buildDraftPrompt([makeChunk()], [], 'template-1', [makeField()]);
    expect(text).toContain('decision_statement');
  });

  it('includes extractionPrompt in field list', () => {
    const { text } = buildDraftPrompt(
      [makeChunk()],
      [],
      'template-1',
      [makeField({ extractionPrompt: 'My custom extraction prompt' })],
    );
    expect(text).toContain('My custom extraction prompt');
  });

  it('includes current draft text as supplementary when provided', () => {
    const { text } = buildDraftPrompt(
      [makeChunk()],
      [],
      'template-1',
      [makeField()],
      [],
      'outcome: We chose managed storage.',
    );
    expect(text).toContain('outcome: We chose managed storage.');
  });
});

// ============================================================================
// buildFieldRegenerationPrompt
// ============================================================================

describe('buildFieldRegenerationPrompt', () => {
  it('includes currentDraftText as supplementary context when provided', () => {
    const currentDraftText = 'decision_statement: We will use managed storage.\noutcome: Approved.';
    const { text } = buildFieldRegenerationPrompt(
      [makeChunk()],
      [],
      'template-1',
      makeField(),
      [],
      currentDraftText,
    );

    expect(text).toContain('We will use managed storage.');
    expect(text).toContain('Approved.');
  });

  it('includes the supplementary label for current draft', () => {
    const { text } = buildFieldRegenerationPrompt(
      [makeChunk()],
      [],
      'template-1',
      makeField(),
      [],
      'decision_statement: Something was decided.',
    );

    expect(text).toContain('Current decision draft');
  });

  it('does not break when currentDraftText is not provided', () => {
    const { text } = buildFieldRegenerationPrompt(
      [makeChunk()],
      [],
      'template-1',
      makeField(),
    );
    expect(text).toContain('decision_statement');
  });

  it('includes extractionPrompt in the field definition', () => {
    const { text } = buildFieldRegenerationPrompt(
      [makeChunk()],
      [],
      'template-1',
      makeField({ extractionPrompt: 'Specific extraction instruction' }),
    );
    expect(text).toContain('Specific extraction instruction');
  });
});

// ============================================================================
// buildDraftPromptFromTemplate
// ============================================================================

describe('buildDraftPromptFromTemplate', () => {
  it('includes currentDraftText when provided', async () => {
    const currentDraftText = 'context: Background from prior discussion.';
    const { text } = await buildDraftPromptFromTemplate(
      [makeChunk()],
      [],
      'template-1',
      [makeField()],
      [],
      'meeting-1',
      'Test Decision',
      'Some context summary',
      currentDraftText,
    );

    expect(text).toContain('context: Background from prior discussion.');
  });

  it('does not break when currentDraftText is not provided', async () => {
    const { text } = await buildDraftPromptFromTemplate(
      [makeChunk()],
      [],
      'template-1',
      [makeField()],
      [],
      'meeting-1',
    );
    expect(text).toContain('decision_statement');
  });
});
