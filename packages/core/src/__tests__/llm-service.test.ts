import { describe, it, expect } from "vitest";
import { MockLLMService } from "../llm/mock-llm-service";
import { PromptBuilder } from "../llm/prompt-builder";
import type { DecisionField, TranscriptChunk } from "@repo/schema";

// Minimal fixture factories
function makeField(overrides: Partial<DecisionField> = {}): DecisionField {
  return {
    id: "field-1",
    name: "decision_statement",
    description: "The core decision being made",
    category: "outcome",
    extractionPrompt: "Extract the main decision statement",
    fieldType: "textarea",
    version: 1,
    isCustom: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeChunk(overrides: Partial<TranscriptChunk> = {}): TranscriptChunk {
  return {
    id: "chunk-1",
    meetingId: "meeting-1",
    rawTranscriptId: "raw-1",
    sequenceNumber: 0,
    text: "We agreed to proceed with the cloud migration.",
    speaker: "Alice",
    chunkStrategy: "semantic",
    contexts: ["meeting:meeting-1"],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("MockLLMService", () => {
  it("generateDraft returns a value for each template field", async () => {
    const mock = new MockLLMService();
    const fields = [makeField({ id: "field-1", name: "decision_statement" })];

    const result = await mock.generateDraft({
      transcriptChunks: [makeChunk()],
      templateFields: fields,
      guidance: [],
    });

    expect(result).toBeDefined();
    expect(typeof Object.values(result.fields)[0]).toBe("string");
    expect(result.fields["field-1"]).toBeDefined();
  });

  it("generateDraft returns canned responses when configured", async () => {
    const mock = new MockLLMService({
      draftResponse: { fields: { "field-1": "Approve cloud migration" }, suggestedTags: [] },
    });

    const result = await mock.generateDraft({
      transcriptChunks: [],
      templateFields: [makeField()],
    });

    expect(result.fields["field-1"]).toBe("Approve cloud migration");
  });

  it("regenerateField returns field-specific canned response", async () => {
    const mock = new MockLLMService({
      fieldResponses: { "field-1": "Regenerated decision statement" },
    });

    const value = await mock.regenerateField({
      transcriptChunks: [],
      templateFields: [makeField()],
      fieldId: "field-1",
    });

    expect(value).toBe("Regenerated decision statement");
  });

  it("setFieldResponse overrides specific field response", async () => {
    const mock = new MockLLMService();
    mock.setFieldResponse("field-1", "Override value");

    const value = await mock.regenerateField({
      transcriptChunks: [],
      templateFields: [makeField()],
      fieldId: "field-1",
    });

    expect(value).toBe("Override value");
  });
});

describe("PromptBuilder", () => {
  it("buildSegments returns typed segment list", () => {
    const builder = new PromptBuilder();
    builder.addSystem("You are an expert...");
    builder.addTranscriptChunk(makeChunk());
    builder.addGuidance({ content: "Focus on cost", source: "user_text" });
    builder.addTemplateFields([makeField()]);

    const segments = builder.buildSegments();
    expect(segments).toHaveLength(4);
    expect(segments[0].type).toBe("system");
    expect(segments[1].type).toBe("transcript");
    expect(segments[2].type).toBe("guidance");
    expect(segments[3].type).toBe("template_fields");
  });

  it("buildString delimits transcript and guidance sections", () => {
    const builder = new PromptBuilder();
    builder.addTranscriptChunk(makeChunk());
    builder.addGuidance({ content: "Focus on cost", source: "user_text" });
    builder.addTemplateFields([makeField()]);

    const prompt = builder.buildString();
    expect(prompt).toContain("=== TRANSCRIPT ===");
    expect(prompt).toContain("[Alice]: We agreed to proceed");
    expect(prompt).toContain("=== GUIDANCE ===");
    expect(prompt).toContain("Focus on cost");
    expect(prompt).toContain("=== FIELDS TO EXTRACT ===");
    expect(prompt).toContain("decision_statement");
  });

  it("buildString labels field-specific guidance with field name", () => {
    const builder = new PromptBuilder();
    builder.addGuidance({ fieldId: "options", content: "List all options", source: "user_text" });

    const prompt = builder.buildString();
    expect(prompt).toContain("=== GUIDANCE (applies to: options field) ===");
    expect(prompt).toContain("List all options");
  });

  it("buildString includes speaker prefix when present", () => {
    const builder = new PromptBuilder();
    builder.addTranscriptChunk(makeChunk({ speaker: "Bob" }));

    const prompt = builder.buildString();
    expect(prompt).toContain("[Bob]:");
  });

  it("buildString omits speaker prefix when absent", () => {
    const builder = new PromptBuilder();
    builder.addTranscriptChunk(makeChunk({ speaker: undefined }));

    const prompt = builder.buildString();
    expect(prompt).not.toContain("[undefined]");
    expect(prompt).toContain("We agreed to proceed");
  });
});
