import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";

process.env.DATABASE_URL =
  "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test";
process.env.USE_MOCK_LLM = "true";

const [{ app }, core] = await Promise.all([import("../index"), import("@repo/core")]);

const {
  createDecisionFieldService,
  createDecisionContextService,
  createDecisionTemplateService,
  createExpertTemplateService,
  createMCPServerService,
  createTranscriptService,
} = core;

const whisperVerboseJsonFixture = readFileSync(
  new URL("../../../../test-cases/transcription/whisper-verbose-json.sample.json", import.meta.url),
  "utf8",
);

describe("API E2E Tests", () => {
  let createdMeetingId: string;
  let deletableMeetingId: string;
  let createdFieldId: string;
  let createdFieldName: string;
  let createdTemplateId: string;
  let alternateTemplateId: string;
  let createdChunkId: string;
  let createdDecisionId: string;
  let deletableDecisionId: string;
  let createdContextId: string;
  let createdExpertId: string;
  let loggedDecisionId: string;
  let createdMCPServerName: string;
  let createdSupplementaryContentId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }

    const fieldService = createDecisionFieldService();
    const templateService = createDecisionTemplateService();
    const expertTemplateService = createExpertTemplateService();
    const mcpServerService = createMCPServerService();

    const field = await fieldService.createField({
      namespace: "test",
      name: `decision_statement_${Date.now()}`,
      description: "Decision statement for API E2E tests",
      category: "outcome",
      extractionPrompt: "Extract the main decision statement",
      fieldType: "textarea",
      placeholder: "Decision statement",
    });
    createdFieldId = field.id;
    createdFieldName = field.name;

    const template = await templateService.createTemplate({
      namespace: "test",
      name: `API E2E Template ${Date.now()}`,
      description: "Template for API E2E tests",
      category: "standard",
      fields: [
        {
          fieldId: field.id,
          order: 0,
          required: true,
        },
      ],
    });
    createdTemplateId = template.id;

    const alternateTemplate = await templateService.createTemplate({
      namespace: "test",
      name: `API E2E Alternate Template ${Date.now()}`,
      description: "Alternate template for API E2E tests",
      category: "strategy",
      fields: [
        {
          fieldId: field.id,
          order: 0,
          required: true,
        },
      ],
    });
    alternateTemplateId = alternateTemplate.id;

    const expert = await expertTemplateService.createTemplate({
      name: `API E2E Expert ${Date.now()}`,
      type: "technical",
      promptTemplate: "Review this decision from a technical perspective.",
      mcpAccess: ["github"],
      isActive: true,
    });
    createdExpertId = expert.id;

    const server = await mcpServerService.createServer({
      name: `api-e2e-mcp-${Date.now()}`,
      type: "stdio",
      connectionConfig: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
      capabilities: { tools: ["search_code"] },
      status: "active",
    });
    createdMCPServerName = server.name;
  });

  it("POST /api/meetings - should create a meeting", async () => {
    const response = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Meeting",
        date: "2026-02-27T10:00:00Z",
        participants: ["Alice", "Bob"],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe("Test Meeting");
    expect(data.participants).toEqual(["Alice", "Bob"]);
    expect(data.status).toBe("proposed");

    createdMeetingId = data.id;
  });

  it("POST /api/meetings - should create a second meeting for delete coverage", async () => {
    const response = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Meeting To Delete",
        date: "2026-02-28T10:00:00Z",
        participants: ["Alice"],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    deletableMeetingId = data.id;
  });

  it("PATCH /api/meetings/:id - should update meeting metadata", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Test Meeting",
        participants: ["Alice", "Bob", "Charlie"],
        status: "in_session",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdMeetingId);
    expect(data.title).toBe("Updated Test Meeting");
    expect(data.participants).toEqual(["Alice", "Bob", "Charlie"]);
    expect(data.status).toBe("in_session");
  });

  it("PATCH /api/meetings/:id - should return 404 for a missing meeting", async () => {
    const response = await app.request("/api/meetings/11111111-1111-4111-8111-111111111111", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Missing meeting update" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/generate-draft - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/generate-draft",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/templates - should list available decision templates", async () => {
    const response = await app.request("/api/templates");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.templates).toBeInstanceOf(Array);
    expect(
      data.templates.some((template: { id: string }) => template.id === createdTemplateId),
    ).toBe(true);
  });

  it("GET /api/templates/:id/fields - should list ordered fields for a template", async () => {
    const response = await app.request(`/api/templates/${createdTemplateId}/fields`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.fields).toBeInstanceOf(Array);
    expect(data.fields).toHaveLength(1);
    expect(data.fields[0].id).toBe(createdFieldId);
    expect(data.fields[0].name).toBe(createdFieldName);
  });

  it("GET /api/templates/:id/fields - should return 404 for a missing template", async () => {
    const response = await app.request(
      "/api/templates/11111111-1111-4111-8111-111111111111/fields",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/experts - should list registered experts", async () => {
    const response = await app.request("/api/experts");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.experts).toBeInstanceOf(Array);
    expect(data.experts.some((expert: { id: string }) => expert.id === createdExpertId)).toBe(true);
  });

  it("GET /api/mcp/servers - should list registered MCP servers", async () => {
    const response = await app.request("/api/mcp/servers");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.servers).toBeInstanceOf(Array);
    expect(
      data.servers.some((server: { name: string }) => server.name === createdMCPServerName),
    ).toBe(true);
  });

  it("POST /api/context/meeting - should set the active meeting context", async () => {
    const response = await app.request("/api/context/meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: createdMeetingId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeMeetingId).toBe(createdMeetingId);
    expect(data.activeMeeting?.id).toBe(createdMeetingId);
  });

  it("POST /api/context/meeting - should return 404 for a missing meeting", async () => {
    const response = await app.request("/api/context/meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/context - should return current context state", async () => {
    const response = await app.request("/api/context");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeMeetingId).toBe(createdMeetingId);
    expect(data.activeMeeting?.id).toBe(createdMeetingId);
  });

  it("GET /api/context/in-session-meetings - should return current context plus meetings with in-session record status", async () => {
    const response = await app.request("/api/context/in-session-meetings");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.currentContext.activeMeetingId).toBe(createdMeetingId);
    expect(data.currentContext.activeMeeting?.id).toBe(createdMeetingId);
    expect(data.inSessionMeetings).toBeInstanceOf(Array);
    expect(
      data.inSessionMeetings.some((meeting: { id: string }) => meeting.id === createdMeetingId),
    ).toBe(true);
    expect(
      data.inSessionMeetings.some((meeting: { id: string }) => meeting.id === deletableMeetingId),
    ).toBe(false);
  });

  it("GET /api/meetings - should list all meetings", async () => {
    const response = await app.request("/api/meetings");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meetings).toBeInstanceOf(Array);
    expect(data.meetings.length).toBeGreaterThan(0);
  });

  it("POST /api/meetings/:id/transcripts/upload - should upload and chunk a transcript", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/transcripts/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content:
          "Alice: We should approve the migration. Bob: Agreed, let us move forward this quarter.",
        format: "txt",
        chunkStrategy: "fixed",
        chunkSize: 20,
        overlap: 0,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.transcript.id).toBeDefined();
    expect(data.transcript.meetingId).toBe(createdMeetingId);
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThan(0);
    expect(data.chunks[0].meetingId).toBe(createdMeetingId);

    createdChunkId = data.chunks[0].id;
  });

  it("DELETE /api/meetings/:id - should return 409 when dependent transcript records exist", async () => {
    const meetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Delete Conflict Meeting ${Date.now()}`,
        date: "2026-03-10T10:00:00Z",
        participants: ["Dependency Tester"],
      }),
    });
    expect(meetingResponse.status).toBe(201);
    const meeting = await meetingResponse.json();

    const uploadResponse = await app.request(`/api/meetings/${meeting.id}/transcripts/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Dependent transcript row for delete conflict validation.",
        format: "txt",
        chunkStrategy: "fixed",
      }),
    });
    expect(uploadResponse.status).toBe(201);

    const deleteResponse = await app.request(`/api/meetings/${meeting.id}`, {
      method: "DELETE",
    });

    expect(deleteResponse.status).toBe(409);
    const deleteBody = await deleteResponse.json();
    expect(typeof deleteBody.error).toBe("string");
    expect(deleteBody.error.toLowerCase()).toContain("dependent");
  });

  it("POST /api/meetings/:id/transcripts/upload - should accept Whisper verbose_json fixture", async () => {
    const meetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Whisper Fixture Meeting ${Date.now()}`,
        date: "2026-03-10T10:00:00Z",
        participants: ["Fixture Tester"],
      }),
    });
    expect(meetingResponse.status).toBe(201);
    const meeting = await meetingResponse.json();

    const uploadResponse = await app.request(`/api/meetings/${meeting.id}/transcripts/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: whisperVerboseJsonFixture,
        format: "json",
        chunkStrategy: "speaker",
      }),
    });

    expect(uploadResponse.status).toBe(201);
    const uploadData = await uploadResponse.json();
    expect(uploadData.transcript.meetingId).toBe(meeting.id);
    expect(uploadData.transcript.format).toBe("json");
    expect(uploadData.chunks).toBeInstanceOf(Array);
    expect(uploadData.chunks.length).toBeGreaterThan(0);
    expect(
      uploadData.chunks.every((chunk: { meetingId: string }) => chunk.meetingId === meeting.id),
    ).toBe(true);

    const readingResponse = await app.request(`/api/meetings/${meeting.id}/transcript-reading`);
    expect(readingResponse.status).toBe(200);
    const readingData = await readingResponse.json();
    expect(readingData.rows).toBeInstanceOf(Array);
    expect(readingData.rows.length).toBeGreaterThanOrEqual(20);
    expect(readingData.rows[0].startTime).toBe("00:00:00");
    expect(readingData.rows[0].endTime).toBe("00:00:02");
    expect(readingData.rows[0].displayText).toContain("starting from the front door");

    await app.request(`/api/meetings/${meeting.id}`, { method: "DELETE" });
  });

  it("GET /api/meetings/:id/transcripts/raw - should list raw transcripts for a meeting", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/transcripts/raw`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.transcripts).toBeInstanceOf(Array);
    expect(data.transcripts.length).toBeGreaterThan(0);
    expect(data.transcripts[0].meetingId).toBe(createdMeetingId);
  });

  it("GET /api/meetings/:id/chunks - should list transcript chunks for a meeting", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/chunks`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThan(0);
    expect(data.chunks.some((chunk: { id: string }) => chunk.id === createdChunkId)).toBe(true);
    expect(
      data.chunks.every((chunk: { meetingId: string }) => chunk.meetingId === createdMeetingId),
    ).toBe(true);
  });

  it("POST /api/chunks/search - should search transcript chunks for a meeting", async () => {
    const response = await app.request("/api/chunks/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: createdMeetingId,
        query: "migration",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThan(0);
    expect(
      data.chunks.some((chunk: { text: string }) => chunk.text.toLowerCase().includes("migration")),
    ).toBe(true);
  });

  it("GET /api/meetings/:id/transcript-reading - should return normalized readable transcript rows", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/transcript-reading`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.rows).toBeInstanceOf(Array);
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows[0].meetingId).toBe(createdMeetingId);
    expect(data.rows[0].rawTranscriptId).toBeDefined();
    expect(data.rows[0].chunkIds).toBeInstanceOf(Array);
    expect(data.rows[0].chunkIds.length).toBeGreaterThan(0);
    expect(data.rows[0].displayText).toContain("Alice: We should approve the migration.");
  });

  it("POST /api/meetings/:id/flagged-decisions - should create a flagged decision", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestedTitle: "Approve migration",
        contextSummary: "Team aligned on completing the migration this quarter.",
        confidence: 1,
        chunkIds: [createdChunkId],
        suggestedTemplateId: createdTemplateId,
        templateConfidence: 1,
        priority: 1,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.meetingId).toBe(createdMeetingId);
    expect(data.chunkIds).toContain(createdChunkId);
    expect(data.suggestedTemplateId).toBe(createdTemplateId);

    createdDecisionId = data.id;
  });

  it("POST /api/meetings/:id/flagged-decisions - should create a second flagged decision for delete coverage", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestedTitle: "Archive old rollout plan",
        contextSummary: "Secondary decision used for delete endpoint coverage.",
        confidence: 1,
        chunkIds: [createdChunkId],
        suggestedTemplateId: createdTemplateId,
        templateConfidence: 1,
        priority: 2,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    deletableDecisionId = data.id;
  });

  it("GET /api/meetings/:id/flagged-decisions - should list flagged decisions for a meeting", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.decisions).toBeInstanceOf(Array);
    const decision = data.decisions.find((item: { id: string }) => item.id === createdDecisionId);
    expect(decision).toBeDefined();
    expect(decision.contextId).toBeNull();
    expect(decision.contextStatus).toBeNull();
    expect(decision.hasDraft).toBe(false);
    expect(decision.draftFieldCount).toBe(0);
    expect(decision.versionCount).toBe(0);
  });

  it("PATCH /api/flagged-decisions/:id - should update a flagged decision", async () => {
    const response = await app.request(`/api/flagged-decisions/${createdDecisionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "accepted",
        priority: 3,
        contextSummary: "Promoted to agenda for active drafting.",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdDecisionId);
    expect(data.status).toBe("accepted");
    expect(data.priority).toBe(3);
    expect(data.contextSummary).toBe("Promoted to agenda for active drafting.");
  });

  it("DELETE /api/flagged-decisions/:id - should delete a flagged decision", async () => {
    const response = await app.request(`/api/flagged-decisions/${deletableDecisionId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);

    const listResponse = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`);
    expect(listResponse.status).toBe(200);
    const data = await listResponse.json();
    expect(
      data.decisions.some((decision: { id: string }) => decision.id === deletableDecisionId),
    ).toBe(false);
  });

  it("GET /api/meetings/:id/flagged-decisions?status=accepted - should filter flagged decisions by status", async () => {
    const response = await app.request(
      `/api/meetings/${createdMeetingId}/flagged-decisions?status=accepted`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.decisions).toBeInstanceOf(Array);
    expect(
      data.decisions.some((decision: { id: string }) => decision.id === createdDecisionId),
    ).toBe(true);
    expect(
      data.decisions.every((decision: { status: string }) => decision.status === "accepted"),
    ).toBe(true);
  });

  it("POST /api/decision-contexts - should create a decision context", async () => {
    const response = await app.request("/api/decision-contexts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: createdMeetingId,
        flaggedDecisionId: createdDecisionId,
        title: "Approve migration",
        templateId: createdTemplateId,
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.meetingId).toBe(createdMeetingId);
    expect(data.flaggedDecisionId).toBe(createdDecisionId);

    createdContextId = data.id;
  });

  it("POST /api/decision-contexts/:id/generate-draft - should accept an empty request body", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/generate-draft`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
  });

  it("POST /api/decision-contexts/:id/template-change - should update the template while preserving draft data", async () => {
    const updateDraftResponse = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Preserve this text" }),
      },
    );

    expect(updateDraftResponse.status).toBe(200);

    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/template-change`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: alternateTemplateId }),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
    expect(data.templateId).toBe(alternateTemplateId);
    expect(data.draftData?.[createdFieldId]).toBe("Preserve this text");
  });

  it("GET /api/decision-contexts/:id/context-window - should list saved context windows", async () => {
    const transcriptService = createTranscriptService();
    await transcriptService.addTranscriptText({
      meetingId: createdMeetingId,
      text: "Decision context window source text for API tests.",
      uploadedBy: "api-e2e",
      contexts: [`decision:${createdContextId}`],
    });
    await transcriptService.createContextWindow(createdContextId, "relevant", "draft");

    const response = await app.request(`/api/decision-contexts/${createdContextId}/context-window`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.windows).toBeInstanceOf(Array);
    expect(data.windows.length).toBeGreaterThanOrEqual(1);
    expect(data.windows[0].decisionContextId).toBe(createdContextId);
    expect(data.windows[0].usedFor).toBe("draft");
  });

  it("GET /api/decision-contexts/:id/context-window - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/context-window",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/context-window - should persist a context window", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/context-window`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionStrategy: "relevant", usedFor: "regenerate" }),
      },
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.decisionContextId).toBe(createdContextId);
    expect(data.selectionStrategy).toBe("relevant");
    expect(data.usedFor).toBe("regenerate");
    expect(Array.isArray(data.chunkIds)).toBe(true);
  });

  it("POST /api/decision-contexts/:id/context-window - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/context-window",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectionStrategy: "relevant", usedFor: "draft" }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decision-contexts/:id/context-window/preview - should preview matching context chunks", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/context-window/preview?strategy=relevant&limit=5`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThanOrEqual(1);
    expect(data.totalTokens).toBeGreaterThan(0);
    expect(Object.keys(data.estimatedRelevance).length).toBeGreaterThanOrEqual(1);
    expect(data.chunks[0].contexts).toContain(`decision:${createdContextId}`);
  });

  it("GET /api/decision-contexts/:id/context-window/preview - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/context-window/preview?strategy=relevant&limit=5",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/meetings/:id/flagged-decisions - should include context and draft summary once a context exists", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/flagged-decisions`);

    expect(response.status).toBe(200);
    const data = await response.json();
    const decision = data.decisions.find((item: { id: string }) => item.id === createdDecisionId);

    expect(decision).toBeDefined();
    expect(decision.contextId).toBe(createdContextId);
    expect(decision.contextStatus).toBe("drafting");
    expect(typeof decision.hasDraft).toBe("boolean");
    expect(decision.draftFieldCount).toBeGreaterThanOrEqual(0);
    expect(decision.versionCount).toBe(0);
  });

  it("GET /api/meetings/:id/decision-contexts - should list decision contexts for a meeting", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/decision-contexts`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.contexts).toBeInstanceOf(Array);
    expect(data.contexts.some((context: { id: string }) => context.id === createdContextId)).toBe(
      true,
    );
  });

  it("GET /api/meetings/:id/summary - should return meeting workflow summary", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/summary`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.decisionCount).toBeGreaterThanOrEqual(1);
    expect(data.draftCount).toBeGreaterThanOrEqual(1);
    expect(data.loggedCount).toBeGreaterThanOrEqual(0);
  });

  it("GET /api/flagged-decisions/:id/context - should return the decision context for a flagged decision", async () => {
    const response = await app.request(`/api/flagged-decisions/${createdDecisionId}/context`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
    expect(data.flaggedDecisionId).toBe(createdDecisionId);
  });

  it("GET /api/flagged-decisions/:id/context - should return 404 for a missing flagged decision context", async () => {
    const response = await app.request(
      "/api/flagged-decisions/11111111-1111-4111-8111-111111111111/context",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/decision - should set the active decision context", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedDecisionId: createdDecisionId }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeMeetingId).toBe(createdMeetingId);
    expect(data.activeDecisionId).toBe(createdDecisionId);
    expect(data.activeDecisionContextId).toBe(createdContextId);
  });

  it("POST /api/meetings/:id/context/decision - should return 404 for a missing flagged decision", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flaggedDecisionId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/field - should set the active field context", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId: createdFieldId }),
    });

    expect([200, 400]).toContain(response.status);
    const data = await response.json();
    if (response.status === 200) {
      expect(data.activeField).toBe(createdFieldId);
      expect(data.activeDecisionContext?.activeField).toBe(createdFieldId);
      return;
    }

    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/field - should return 404 for a missing field", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId: "11111111-1111-4111-8111-111111111111" }),
    });

    expect([400, 404]).toContain(response.status);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/decision - should return 404 for a missing meeting", async () => {
    const response = await app.request(
      "/api/meetings/11111111-1111-4111-8111-111111111111/context/decision",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flaggedDecisionId: createdDecisionId }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/field - should return 404 for a missing meeting", async () => {
    const response = await app.request(
      "/api/meetings/11111111-1111-4111-8111-111111111111/context/field",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: createdFieldId }),
      },
    );

    expect([400, 404]).toContain(response.status);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/meetings/:id/context/field - should return 400 when the active meeting does not match", async () => {
    const mismatchMeetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Context mismatch meeting ${Date.now()}`,
        date: "2026-03-10T12:00:00Z",
        participants: ["Mismatch Tester"],
      }),
    });
    expect(mismatchMeetingResponse.status).toBe(201);
    const mismatchMeeting = await mismatchMeetingResponse.json();

    const response = await app.request(`/api/meetings/${mismatchMeeting.id}/context/field`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId: createdFieldId }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/supplementary-content - should create supplementary content", async () => {
    const response = await app.request("/api/supplementary-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingId: createdMeetingId,
        label: "Comparison table",
        body: "Option 1: approve migration now. Option 2: delay until next quarter.",
        sourceType: "manual",
        contexts: [`decision:${createdContextId}:${createdFieldId}`],
        createdBy: "api-e2e-user",
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.meetingId).toBe(createdMeetingId);
    expect(data.contexts).toContain(`decision:${createdContextId}:${createdFieldId}`);
    createdSupplementaryContentId = data.id;
  });

  it("GET /api/supplementary-content?context=... - should list supplementary content for a context tag", async () => {
    const response = await app.request(
      `/api/supplementary-content?context=${encodeURIComponent(`decision:${createdContextId}:${createdFieldId}`)}`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toBeInstanceOf(Array);
    expect(
      data.items.some((item: { id: string }) => item.id === createdSupplementaryContentId),
    ).toBe(true);
  });

  it("GET /api/supplementary-content - should return 400 for an empty context query", async () => {
    const response = await app.request("/api/supplementary-content?context=");

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("PUT /api/decision-contexts/:id/lock-field - should lock a field", async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/lock-field`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldId: createdFieldId,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).toContain(createdFieldId);
  });

  it("DELETE /api/decision-contexts/:id/lock-field - should unlock a field", async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/lock-field`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldId: createdFieldId,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.lockedFields).not.toContain(createdFieldId);
  });

  it("POST /api/meetings/:id/transcripts/stream - should buffer a text event with auto-injected contexts", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/transcripts/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "We should defer the vendor selection until next week.",
        speaker: "Alice",
        contexts: ["manual:note"],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.buffering).toBe(true);
    expect(data.bufferSize).toBeGreaterThanOrEqual(1);
    expect(data.appliedContexts).toContain(`meeting:${createdMeetingId}`);
    expect(data.appliedContexts).toContain("manual:note");
  });

  it("GET /api/meetings/:id/streaming/status - should return buffer status", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/streaming/status`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("active");
    expect(data.eventCount).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/meetings/:id/streaming/flush - should flush buffered events into transcript chunks", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/streaming/flush`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks.length).toBeGreaterThanOrEqual(1);
    expect(data.chunks[0].contexts).toContain(`meeting:${createdMeetingId}`);
  });

  it("DELETE /api/meetings/:id/streaming/buffer - should clear the streaming buffer", async () => {
    const seedResponse = await app.request(`/api/meetings/${createdMeetingId}/transcripts/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Buffer item to clear" }),
    });
    expect(seedResponse.status).toBe(201);

    const response = await app.request(`/api/meetings/${createdMeetingId}/streaming/buffer`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);

    const statusResponse = await app.request(`/api/meetings/${createdMeetingId}/streaming/status`);
    expect(statusResponse.status).toBe(200);
    const statusData = await statusResponse.json();
    expect(statusData.status).toBe("idle");
    expect(statusData.eventCount).toBe(0);
  });

  it("GET /api/decision-contexts/:id/versions - should return saved versions", async () => {
    await app.request(`/api/decision-contexts/${createdContextId}/generate-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await app.request(`/api/decision-contexts/${createdContextId}/versions`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.versions).toBeInstanceOf(Array);
  });

  it("GET /api/decision-contexts/:id/versions - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/versions",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/rollback - should restore a saved version", async () => {
    await app.request(`/api/decision-contexts/${createdContextId}/generate-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await app.request(`/api/decision-contexts/${createdContextId}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1 }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
    expect(data.draftVersions).toBeInstanceOf(Array);
  });

  it("POST /api/decision-contexts/:id/rollback - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/rollback",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: 1 }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/regenerate - should regenerate a draft using persisted context", async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
    expect(data.draftData).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/regenerate - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/regenerate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("PATCH /api/decision-contexts/:id/fields/:fieldId - should manually update a field value", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Manually edited decision statement" }),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdContextId);
    expect(data.draftData?.[createdFieldId]).toBe("Manually edited decision statement");
    expect(data.draftData?.__fieldMeta?.[createdFieldId]?.manuallyEdited).toBe(true);
  });

  it("PATCH /api/decision-contexts/:id/fields/:fieldId - should reject a stable field name reference", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldName}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Updated via field name" }),
      },
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("PATCH /api/decision-contexts/:id/fields/:fieldId - should reject fields not assigned to the template", async () => {
    const unassignedField = await createDecisionFieldService().createField({
      namespace: "test",
      name: `unassigned_field_${Date.now()}`,
      description: "Unassigned field for negative API E2E test",
      category: "context",
      extractionPrompt: "Should not be used",
      fieldType: "textarea",
      placeholder: "Unused",
    });

    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${unassignedField.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Should fail" }),
      },
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain(`Field ${unassignedField.id} is not assigned to template`);
  });

  it("PATCH /api/decision-contexts/:id/fields/:fieldId - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/fields/" + createdFieldId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Should fail for missing context" }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decision-contexts/:id/fields/:fieldId/transcript - should return field transcript chunks", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}/transcript`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
  });

  it("GET /api/decision-contexts/:id/fields/:fieldId/transcript - should reject a stable field name reference", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldName}/transcript`,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decision-contexts/:id/fields/:fieldId/transcript - should return 404 for a missing field", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/11111111-1111-4111-8111-111111111111/transcript`,
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/transcript/context - should tag chunks at decision scope", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/transcript/context`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: [createdChunkId] }),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks[0].contexts).toContain(`decision:${createdContextId}`);
  });

  it("POST /api/decision-contexts/:id/transcript/context - should return 404 for missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/transcript/context",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: [createdChunkId] }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/transcript/context - should tag chunks at field scope", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}/transcript/context`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: [createdChunkId] }),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.chunks).toBeInstanceOf(Array);
    expect(data.chunks[0].contexts).toContain(`decision:${createdContextId}`);
    expect(data.chunks[0].contexts).toContain(`decision:${createdContextId}:${createdFieldId}`);
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/transcript/context - should return 404 for missing field", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/11111111-1111-4111-8111-111111111111/transcript/context`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: [createdChunkId] }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/regenerate - should regenerate a single field", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.value).toBe("string");
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/regenerate - should return 404 for a missing context", async () => {
    const response = await app.request(
      `/api/decision-contexts/11111111-1111-4111-8111-111111111111/fields/${createdFieldId}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/regenerate - should return 400 for an unassigned field reference", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/11111111-1111-4111-8111-111111111111/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/fields/:fieldId/regenerate - should reject a stable field name reference", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldName}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/log - should finalize and log a decision", async () => {
    const contextUpdateResponse = await app.request(
      `/api/decision-contexts/${createdContextId}/fields/${createdFieldId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: "Approved migration plan" }),
      },
    );
    expect(contextUpdateResponse.status).toBe(200);

    const decisionContextService = createDecisionContextService();
    const reviewingContext = await decisionContextService.submitForReview(createdContextId);
    expect(reviewingContext?.status).toBe("reviewing");
    const lockedContext = await decisionContextService.approveAndLock(createdContextId);
    expect(lockedContext?.status).toBe("locked");

    const statusResponse = await app.request(`/api/decision-contexts/${createdContextId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loggedBy: "api-e2e-user",
        decisionMethod: { type: "manual", details: "Confirmed in API test" },
      }),
    });

    expect(statusResponse.status).toBe(200);
    const data = await statusResponse.json();
    expect(data.id).toBeDefined();
    expect(data.decisionContextId).toBe(createdContextId);
    expect(typeof data.templateId).toBe("string");
    loggedDecisionId = data.id;
  });

  it("POST /api/decision-contexts/:id/log - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/log",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedBy: "api-e2e-user",
          decisionMethod: { type: "manual", details: "Missing context path" },
        }),
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("POST /api/decision-contexts/:id/log - should return 400 for invalid decision method payloads", async () => {
    const response = await app.request(`/api/decision-contexts/${createdContextId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loggedBy: "api-e2e-user",
        decisionMethod: { type: "not-a-real-method" },
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decisions/:id - should return a decision log", async () => {
    const response = await app.request(`/api/decisions/${loggedDecisionId}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(loggedDecisionId);
    expect(data.decisionContextId).toBe(createdContextId);
  });

  it("GET /api/decisions/:id - should return 404 for a missing decision log", async () => {
    const response = await app.request("/api/decisions/11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decisions/:id/export?format=json - should export a decision log as json", async () => {
    const response = await app.request(`/api/decisions/${loggedDecisionId}/export?format=json`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.format).toBe("json");
    expect(data.content.id).toBe(loggedDecisionId);
  });

  it("GET /api/decisions/:id/export - should return 404 for a missing decision log", async () => {
    const response = await app.request(
      "/api/decisions/11111111-1111-4111-8111-111111111111/export?format=json",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decisions/:id/export?format=markdown - should export a decision log as markdown", async () => {
    const response = await app.request(`/api/decisions/${loggedDecisionId}/export?format=markdown`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.format).toBe("markdown");
    expect(typeof data.content).toBe("string");
    expect(data.content).toContain("# Decision:");
  });

  it("GET /api/decision-contexts/:id/export/markdown - should export markdown", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/export/markdown`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.markdown).toBe("string");
    expect(data.markdown).toContain("# Decision:");
    expect(data.markdown).toContain("##");
  });

  it("GET /api/decision-contexts/:id/export/markdown - should return 404 for a missing context", async () => {
    const response = await app.request(
      "/api/decision-contexts/11111111-1111-4111-8111-111111111111/export/markdown",
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decision-contexts/:id/export/markdown - should return 400 for invalid export query values", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/export/markdown?fieldOrder=invalid`,
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("GET /api/decision-contexts/:id/llm-interactions - should return interactions array", async () => {
    const response = await app.request(
      `/api/decision-contexts/${createdContextId}/llm-interactions`,
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.interactions).toBeInstanceOf(Array);
  });

  it("DELETE /api/supplementary-content/:id - should remove supplementary content", async () => {
    const response = await app.request(
      `/api/supplementary-content/${createdSupplementaryContentId}`,
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(204);

    const listResponse = await app.request(
      `/api/supplementary-content?context=${encodeURIComponent(`decision:${createdContextId}:${createdFieldId}`)}`,
    );
    expect(listResponse.status).toBe(200);
    const listData = await listResponse.json();
    expect(
      listData.items.some((item: { id: string }) => item.id === createdSupplementaryContentId),
    ).toBe(false);
  });

  it("DELETE /api/supplementary-content/:id - should return 404 for a missing item", async () => {
    const response = await app.request(
      "/api/supplementary-content/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("DELETE /api/meetings/:id/context/field - should clear the active field context", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/field`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeField).toBeUndefined();
    expect(data.activeMeetingId).toBe(createdMeetingId);
  });

  it("DELETE /api/meetings/:id/context/field - should return 400 when the active meeting does not match", async () => {
    const mismatchMeetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Field clear mismatch meeting ${Date.now()}`,
        date: "2026-03-10T13:00:00Z",
        participants: ["Mismatch Tester"],
      }),
    });
    expect(mismatchMeetingResponse.status).toBe(201);
    const mismatchMeeting = await mismatchMeetingResponse.json();

    const response = await app.request(`/api/meetings/${mismatchMeeting.id}/context/field`, {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("DELETE /api/meetings/:id/context/decision - should clear the active decision context", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}/context/decision`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeMeetingId).toBe(createdMeetingId);
    expect(data.activeDecisionId).toBeUndefined();
    expect(data.activeDecisionContextId).toBeUndefined();
  });

  it("DELETE /api/meetings/:id/context/decision - should return 400 when the active meeting does not match", async () => {
    const restoreMeetingContextResponse = await app.request("/api/context/meeting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: createdMeetingId }),
    });
    expect(restoreMeetingContextResponse.status).toBe(200);

    const restoreDecisionContextResponse = await app.request(
      `/api/meetings/${createdMeetingId}/context/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flaggedDecisionId: createdDecisionId }),
      },
    );
    expect(restoreDecisionContextResponse.status).toBe(200);

    const mismatchMeetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Decision clear mismatch meeting ${Date.now()}`,
        date: "2026-03-10T14:00:00Z",
        participants: ["Mismatch Tester"],
      }),
    });
    expect(mismatchMeetingResponse.status).toBe(201);
    const mismatchMeeting = await mismatchMeetingResponse.json();

    const response = await app.request(`/api/meetings/${mismatchMeeting.id}/context/decision`, {
      method: "DELETE",
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("DELETE /api/context/meeting - should clear the active meeting context", async () => {
    const response = await app.request("/api/context/meeting", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.activeMeetingId).toBeUndefined();
    expect(data.activeDecisionId).toBeUndefined();
  });

  it("GET /api/meetings/:id - should get a specific meeting", async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdMeetingId);
    expect(data.title).toBe("Updated Test Meeting");
  });

  it("DELETE /api/meetings/:id - should delete a meeting", async () => {
    const response = await app.request(`/api/meetings/${deletableMeetingId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);

    const getResponse = await app.request(`/api/meetings/${deletableMeetingId}`);
    expect(getResponse.status).toBe(404);
  });

  it("DELETE /api/meetings/:id - should return 404 for a missing meeting", async () => {
    const response = await app.request("/api/meetings/11111111-1111-4111-8111-111111111111", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("DELETE /api/meetings/:id - should return 409 when dependent records exist", async () => {
    const meetingResponse = await app.request("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Meeting With Dependencies ${Date.now()}`,
        date: "2026-03-10T11:00:00Z",
        participants: ["Dependency Tester"],
      }),
    });
    expect(meetingResponse.status).toBe(201);
    const meeting = await meetingResponse.json();

    const uploadResponse = await app.request(`/api/meetings/${meeting.id}/transcripts/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Dependency check transcript content.",
        format: "txt",
        chunkStrategy: "fixed",
        chunkSize: 20,
        overlap: 0,
      }),
    });
    expect(uploadResponse.status).toBe(201);

    const response = await app.request(`/api/meetings/${meeting.id}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error).toContain("dependent records");
  });

  it("GET /api/meetings/:id - should return 404 for non-existent meeting", async () => {
    const response = await app.request("/api/meetings/11111111-1111-4111-8111-111111111111");

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Meeting not found");
  });

  it("GET /health - should return health status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  it("GET /api/status - should return safe runtime diagnostics", async () => {
    const response = await app.request("/api/status");

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.nodeEnv).toBe("string");
    expect(typeof data.databaseConfigured).toBe("boolean");
    expect(["mock", "real"]).toContain(data.llm.mode);
    expect(typeof data.llm.provider).toBe("string");
    expect(typeof data.llm.model).toBe("string");
  });

  it("GET /openapi.json - should return OpenAPI spec", async () => {
    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);
    const data = await response.json();
    const pathKeys = Object.keys(data.paths ?? {});
    expect(data.openapi).toBe("3.0.0");
    expect(data.paths).toHaveProperty("/api/meetings");
    expect(pathKeys).toContain("/api/status");
    expect(pathKeys).toContain("/api/context");
    expect(pathKeys).toContain("/api/context/meeting");
    expect(
      pathKeys.some(
        (path) => path.includes("/api/meetings/") && path.endsWith("/context/decision"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/api/meetings/") && path.endsWith("/context/field")),
    ).toBe(true);
    expect(pathKeys.some((path) => path.includes("/transcripts/upload"))).toBe(true);
    expect(pathKeys.some((path) => path.includes("/transcripts/stream"))).toBe(true);
    expect(pathKeys.some((path) => path.includes("/streaming/status"))).toBe(true);
    expect(pathKeys.some((path) => path.includes("/streaming/flush"))).toBe(true);
    expect(pathKeys.some((path) => path.includes("/streaming/buffer"))).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/api/meetings/") && path.endsWith("/summary")),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/api/meetings/") && path.endsWith("/decision-contexts"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/decision-contexts/") && path.endsWith("/versions")),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/decision-contexts/") && path.endsWith("/rollback")),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/decision-contexts/") && path.endsWith("/regenerate")),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) =>
          path.includes("/decision-contexts/") &&
          path.includes("/fields/") &&
          path.endsWith("/regenerate"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) =>
          path.includes("/decision-contexts/") &&
          path.includes("/fields/") &&
          path.endsWith("/transcript"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/decision-contexts/") && path.endsWith("/transcript/context"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) =>
          path.includes("/decision-contexts/") &&
          path.includes("/fields/") &&
          path.endsWith("/transcript/context"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/decision-contexts/") && path.endsWith("/log")),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/api/decisions/") && !path.endsWith("/export")),
    ).toBe(true);
    expect(
      pathKeys.some((path) => path.includes("/api/decisions/") && path.endsWith("/export")),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/decision-contexts/") && path.endsWith("/llm-interactions"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/api/meetings/") && path.endsWith("/flagged-decisions"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/api/flagged-decisions/") && !path.endsWith("/context"),
      ),
    ).toBe(true);
    expect(
      pathKeys.some(
        (path) => path.includes("/api/flagged-decisions/") && path.endsWith("/context"),
      ),
    ).toBe(true);
    expect(pathKeys).toContain("/api/supplementary-content");
    expect(
      pathKeys.some(
        (path) =>
          path.includes("/api/supplementary-content/") && path !== "/api/supplementary-content",
      ),
    ).toBe(true);

    const decisionLogPath = pathKeys.find(
      (path) => path.includes("/api/decisions/") && !path.endsWith("/export"),
    );
    expect(decisionLogPath).toBeDefined();
    const decisionLogResponses = decisionLogPath
      ? data.paths[decisionLogPath]?.get?.responses
      : undefined;
    expect(decisionLogResponses).toBeDefined();
    expect(decisionLogResponses?.["200"]).toBeDefined();
    expect(decisionLogResponses?.["404"]).toBeDefined();

    const statusResponses = data.paths["/api/status"]?.get?.responses;
    expect(statusResponses).toBeDefined();
    expect(statusResponses?.["200"]).toBeDefined();

    const versionsPath = pathKeys.find(
      (path) => path.includes("/decision-contexts/") && path.endsWith("/versions"),
    );
    expect(versionsPath).toBeDefined();
    const versionsResponses = versionsPath ? data.paths[versionsPath]?.get?.responses : undefined;
    expect(versionsResponses).toBeDefined();
    expect(versionsResponses?.["200"]).toBeDefined();
    expect(versionsResponses?.["404"]).toBeDefined();

    const updateFieldPath = pathKeys.find(
      (path) =>
        path.includes("/decision-contexts/") &&
        path.includes("/fields/") &&
        !path.endsWith("/transcript") &&
        !path.endsWith("/regenerate"),
    );
    expect(updateFieldPath).toBeDefined();
    const updateFieldResponses = updateFieldPath
      ? data.paths[updateFieldPath]?.patch?.responses
      : undefined;
    expect(updateFieldResponses).toBeDefined();
    expect(updateFieldResponses?.["200"]).toBeDefined();
    expect(updateFieldResponses?.["400"]).toBeDefined();
    expect(updateFieldResponses?.["404"]).toBeDefined();

    const fieldTranscriptPath = pathKeys.find(
      (path) =>
        path.includes("/decision-contexts/") &&
        path.includes("/fields/") &&
        path.endsWith("/transcript"),
    );
    expect(fieldTranscriptPath).toBeDefined();
    const fieldTranscriptResponses = fieldTranscriptPath
      ? data.paths[fieldTranscriptPath]?.get?.responses
      : undefined;
    expect(fieldTranscriptResponses).toBeDefined();
    expect(fieldTranscriptResponses?.["200"]).toBeDefined();
    expect(fieldTranscriptResponses?.["400"]).toBeDefined();
    expect(fieldTranscriptResponses?.["404"]).toBeDefined();

    const generateDraftPath = pathKeys.find(
      (path) => path.includes("/decision-contexts/") && path.endsWith("/generate-draft"),
    );
    expect(generateDraftPath).toBeDefined();
    const generateDraftResponses = generateDraftPath
      ? data.paths[generateDraftPath]?.post?.responses
      : undefined;
    expect(generateDraftResponses).toBeDefined();
    expect(generateDraftResponses?.["200"]).toBeDefined();
    expect(generateDraftResponses?.["400"]).toBeDefined();
    expect(generateDraftResponses?.["404"]).toBeDefined();

    const regenerateFieldPath = pathKeys.find(
      (path) =>
        path.includes("/decision-contexts/") &&
        path.includes("/fields/") &&
        path.endsWith("/regenerate"),
    );
    expect(regenerateFieldPath).toBeDefined();
    const regenerateFieldResponses = regenerateFieldPath
      ? data.paths[regenerateFieldPath]?.post?.responses
      : undefined;
    expect(regenerateFieldResponses).toBeDefined();
    expect(regenerateFieldResponses?.["200"]).toBeDefined();
    expect(regenerateFieldResponses?.["400"]).toBeDefined();
    expect(regenerateFieldResponses?.["404"]).toBeDefined();

    const logDecisionPath = pathKeys.find(
      (path) => path.includes("/decision-contexts/") && path.endsWith("/log"),
    );
    expect(logDecisionPath).toBeDefined();
    const logDecisionResponses = logDecisionPath
      ? data.paths[logDecisionPath]?.post?.responses
      : undefined;
    expect(logDecisionResponses).toBeDefined();
    expect(logDecisionResponses?.["200"]).toBeDefined();
    expect(logDecisionResponses?.["400"]).toBeDefined();
    expect(logDecisionResponses?.["404"]).toBeDefined();
  });
});
