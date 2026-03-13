/**
 * Schema Sanity Check Test
 *
 * Validates that Zod schemas and Drizzle schemas are aligned.
 * This ensures type consistency across the application.
 */

import { describe, it, expect } from "vitest";
import * as zodSchemas from "@repo/schema";
import * as drizzleSchema from "../schema";

describe("Schema Alignment", () => {
  it("should have matching Meeting schemas", () => {
    // Drizzle table exists
    expect(drizzleSchema.meetings).toBeDefined();
    expect(zodSchemas.MeetingSchema).toBeDefined();
  });

  it("should have matching RawTranscript schemas", () => {
    expect(drizzleSchema.rawTranscripts).toBeDefined();
    expect(zodSchemas.RawTranscriptSchema).toBeDefined();
  });

  it("should have matching TranscriptChunk schemas", () => {
    expect(drizzleSchema.transcriptChunks).toBeDefined();
    expect(zodSchemas.TranscriptChunkSchema).toBeDefined();
  });

  it("should have matching ChunkRelevance schemas", () => {
    expect(drizzleSchema.chunkRelevance).toBeDefined();
    expect(zodSchemas.ChunkRelevanceSchema).toBeDefined();
  });

  it("should have matching DecisionContextWindow schemas", () => {
    expect(drizzleSchema.decisionContextWindows).toBeDefined();
    expect(zodSchemas.DecisionContextWindowSchema).toBeDefined();
  });

  it("should have matching DecisionField schemas", () => {
    expect(drizzleSchema.decisionFields).toBeDefined();
    expect(zodSchemas.DecisionFieldSchema).toBeDefined();
  });

  it("should have matching DecisionTemplate schemas", () => {
    expect(drizzleSchema.decisionTemplates).toBeDefined();
    expect(zodSchemas.DecisionTemplateSchema).toBeDefined();
  });

  it("should have matching TemplateFieldAssignment schemas", () => {
    expect(drizzleSchema.templateFieldAssignments).toBeDefined();
    expect(zodSchemas.TemplateFieldAssignmentSchema).toBeDefined();
  });

  it("should have matching FlaggedDecision schemas", () => {
    expect(drizzleSchema.flaggedDecisions).toBeDefined();
    expect(zodSchemas.FlaggedDecisionSchema).toBeDefined();
  });

  it("should have matching DecisionContext schemas", () => {
    expect(drizzleSchema.decisionContexts).toBeDefined();
    expect(zodSchemas.DecisionContextSchema).toBeDefined();
  });

  it("should have matching DecisionLog schemas", () => {
    expect(drizzleSchema.decisionLogs).toBeDefined();
    expect(zodSchemas.DecisionLogSchema).toBeDefined();
  });

  it("should have matching ExpertTemplate schemas", () => {
    expect(drizzleSchema.expertTemplates).toBeDefined();
    expect(zodSchemas.ExpertTemplateSchema).toBeDefined();
  });

  it("should have matching MCPServer schemas", () => {
    expect(drizzleSchema.mcpServers).toBeDefined();
    expect(zodSchemas.MCPServerSchema).toBeDefined();
  });

  it("should have matching ExpertAdvice schemas", () => {
    expect(drizzleSchema.expertAdvice).toBeDefined();
    expect(zodSchemas.ExpertAdviceSchema).toBeDefined();
  });

  it("should have all required enums defined", () => {
    // Check Drizzle enums exist
    expect(drizzleSchema.meetingStatusEnum).toBeDefined();
    expect(drizzleSchema.transcriptSourceEnum).toBeDefined();
    expect(drizzleSchema.transcriptFormatEnum).toBeDefined();
    expect(drizzleSchema.chunkStrategyEnum).toBeDefined();
    expect(drizzleSchema.selectionStrategyEnum).toBeDefined();
    expect(drizzleSchema.usedForEnum).toBeDefined();
    expect(drizzleSchema.flaggedDecisionStatusEnum).toBeDefined();
    expect(drizzleSchema.decisionContextStatusEnum).toBeDefined();
    expect(drizzleSchema.decisionMethodEnum).toBeDefined();
    expect(drizzleSchema.fieldCategoryEnum).toBeDefined();
    expect(drizzleSchema.fieldTypeEnum).toBeDefined();
    expect(drizzleSchema.templateCategoryEnum).toBeDefined();
    expect(drizzleSchema.expertTypeEnum).toBeDefined();
    expect(drizzleSchema.mcpServerTypeEnum).toBeDefined();
    expect(drizzleSchema.mcpServerStatusEnum).toBeDefined();
    expect(drizzleSchema.taggedByEnum).toBeDefined();
  });

  it("should export all tables in schema object", () => {
    expect(drizzleSchema.schema.meetings).toBeDefined();
    expect(drizzleSchema.schema.rawTranscripts).toBeDefined();
    expect(drizzleSchema.schema.transcriptChunks).toBeDefined();
    expect(drizzleSchema.schema.chunkRelevance).toBeDefined();
    expect(drizzleSchema.schema.decisionContextWindows).toBeDefined();
    expect(drizzleSchema.schema.decisionFields).toBeDefined();
    expect(drizzleSchema.schema.decisionTemplates).toBeDefined();
    expect(drizzleSchema.schema.templateFieldAssignments).toBeDefined();
    expect(drizzleSchema.schema.flaggedDecisions).toBeDefined();
    expect(drizzleSchema.schema.decisionContexts).toBeDefined();
    expect(drizzleSchema.schema.decisionLogs).toBeDefined();
    expect(drizzleSchema.schema.expertTemplates).toBeDefined();
    expect(drizzleSchema.schema.mcpServers).toBeDefined();
    expect(drizzleSchema.schema.expertAdvice).toBeDefined();
  });
});

describe("Zod Schema Validation", () => {
  it("should validate Meeting data correctly", () => {
    const validMeeting = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Test Meeting",
      date: "2026-02-27T10:00:00Z",
      participants: ["Alice", "Bob"],
      status: "in_session",
      createdAt: "2026-02-27T10:00:00Z",
    };

    const result = zodSchemas.MeetingSchema.safeParse(validMeeting);
    expect(result.success).toBe(true);
  });

  it("should validate DecisionField data correctly", () => {
    const validField = {
      id: "550e8400-e29b-41d4-a716-446655440005",
      namespace: "core",
      name: "decision_statement",
      description: "The core decision being made",
      category: "outcome",
      extractionPrompt: "Extract the main decision statement",
      fieldType: "textarea",
      version: 1,
      isCustom: false,
      createdAt: "2026-02-27T10:00:00Z",
    };

    const result = zodSchemas.DecisionFieldSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("should validate DecisionTemplate data correctly", () => {
    const validTemplate = {
      id: "550e8400-e29b-41d4-a716-446655440008",
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
    };

    const result = zodSchemas.DecisionTemplateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
  });
});
