import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  createMeetingRoute,
  deleteMeetingRoute,
  getMeetingSummaryRoute,
  getMeetingTranscriptReadingRoute,
  listMeetingsRoute,
  listMeetingDecisionContextsRoute,
  getMeetingRoute,
  updateMeetingRoute,
} from "./routes/meetings.js";
import {
  createDecisionLogGenerator,
  createDecisionLogService,
  createDecisionContextService,
  createDecisionContextRepository,
  createDecisionFieldService,
  createDecisionTemplateService,
  createExportTemplateService,
  createExpertTemplateService,
  createDraftGenerationService,
  createFeedbackService,
  createFlaggedDecisionService,
  createGlobalContextService,
  createLLMInteractionService,
  createMarkdownExportService,
  createMCPServerService,
  createMeetingService,
  createSupplementaryContentService,
  createTemplateFieldAssignmentRepository,
  createTranscriptService,
  type IMeetingRepository,
  MeetingService,
} from "@repo/core";
import { DrizzleMeetingRepository } from "@repo/db";
import { MockMeetingRepository } from "./mock-repository.js";
import {
  clearDecisionContextRoute,
  clearFieldContextRoute,
  clearMeetingContextRoute,
  getInSessionMeetingsContextSummaryRoute,
  getContextRoute,
  setDecisionContextRoute,
  setFieldContextRoute,
  setMeetingContextRoute,
} from "./routes/context.js";
import {
  clearStreamingBufferRoute,
  changeDecisionContextTemplateRoute,
  createDecisionContextRoute,
  createDecisionFeedbackRoute,
  createDecisionContextWindowRoute,
  assignDecisionTranscriptContextRoute,
  assignFieldTranscriptContextRoute,
  createSupplementaryContentRoute,
  createFlaggedDecisionRoute,
  deleteDecisionFeedbackRoute,
  deleteFlaggedDecisionRoute,
  deleteSupplementaryContentRoute,
  exportDecisionLogRoute,
  exportMarkdownRoute,
  flushStreamingRoute,
  getApiStatusRoute,
  getDecisionContextRoute,
  getFlaggedDecisionContextRoute,
  getDecisionLogRoute,
  getFieldTranscriptRoute,
  getStreamingStatusRoute,
  generateDraftRoute,
  listDecisionFeedbackRoute,
  listExpertsRoute,
  listFieldDecisionFeedbackRoute,
  listMeetingChunksRoute,
  listRawTranscriptsRoute,
  listDraftVersionsRoute,
  listFlaggedDecisionsRoute,
  listDecisionContextWindowsRoute,
  listLLMInteractionsRoute,
  listMCPServersRoute,
  listSupplementaryContentRoute,
  listTemplatesRoute,
  listTemplateFieldsRoute,
  listTemplateExportTemplatesRoute,
  logDecisionRoute,
  lockFieldRoute,
  previewDecisionContextWindowRoute,
  regenerateDraftRoute,
  regenerateFieldRoute,
  rollbackDraftRoute,
  searchChunksRoute,
  streamTranscriptRoute,
  toggleDecisionFeedbackExcludeRoute,
  unlockFieldRoute,
  updateDecisionContextRoute,
  updateFlaggedDecisionRoute,
  updateFieldValueRoute,
  uploadTranscriptRoute,
} from "./routes/decision-workflow.js";

// Determine which repository to use
const useDatabase = process.env.DATABASE_URL !== undefined;

// Create repository and service instances
const repo: IMeetingRepository = useDatabase
  ? new DrizzleMeetingRepository()
  : new MockMeetingRepository();

console.log(`Using ${useDatabase ? "Drizzle" : "Mock"} repository`);

const meetingService = useDatabase ? createMeetingService() : new MeetingService(repo);
const transcriptService = useDatabase ? createTranscriptService() : null;
const flaggedDecisionService = useDatabase ? createFlaggedDecisionService() : null;
const decisionContextService = useDatabase ? createDecisionContextService() : null;
const decisionLogService = useDatabase ? createDecisionLogService() : null;
const decisionLogGenerator = useDatabase ? createDecisionLogGenerator() : null;
const draftGenerationService = useDatabase ? createDraftGenerationService() : null;
const feedbackService = useDatabase ? createFeedbackService() : null;
const globalContextService = useDatabase ? createGlobalContextService() : null;
const supplementaryContentService = useDatabase ? createSupplementaryContentService() : null;
const markdownExportService = useDatabase ? createMarkdownExportService() : null;
const llmInteractionService = useDatabase ? createLLMInteractionService() : null;
const decisionContextRepository = useDatabase ? createDecisionContextRepository() : null;
const decisionFieldService = useDatabase ? createDecisionFieldService() : null;
const decisionTemplateService = useDatabase ? createDecisionTemplateService() : null;
const exportTemplateService = useDatabase ? createExportTemplateService() : null;
const expertTemplateService = useDatabase ? createExpertTemplateService() : null;
const mcpServerService = useDatabase ? createMCPServerService() : null;
const templateFieldAssignmentRepository = useDatabase
  ? createTemplateFieldAssignmentRepository()
  : null;

function getWorkflowServices() {
  if (
    !transcriptService ||
    !flaggedDecisionService ||
    !decisionContextService ||
    !decisionContextRepository ||
    !decisionFieldService ||
    !decisionLogService ||
    !decisionLogGenerator ||
    !draftGenerationService ||
    !feedbackService ||
    !supplementaryContentService ||
    !markdownExportService ||
    !llmInteractionService ||
    !templateFieldAssignmentRepository
  ) {
    return null;
  }

  return {
    transcriptService,
    flaggedDecisionService,
    decisionContextService,
    decisionContextRepository,
    decisionFieldService,
    decisionLogService,
    decisionLogGenerator,
    draftGenerationService,
    feedbackService,
    supplementaryContentService,
    markdownExportService,
    llmInteractionService,
    templateFieldAssignmentRepository,
  };
}

function isNotFoundErrorMessage(message: string): boolean {
  return message.includes("not found");
}

function isDependencyConflictErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("foreign key") ||
    normalized.includes("constraint") ||
    normalized.includes("dependent")
  );
}

async function resolveContextFieldId(
  services: NonNullable<ReturnType<typeof getWorkflowServices>>,
  contextId: string,
  fieldReference: string,
): Promise<string> {
  const context = await services.decisionContextRepository.findById(contextId);
  if (!context) {
    throw new Error("Decision context not found");
  }

  const assignments = await services.templateFieldAssignmentRepository.findByTemplateId(
    context.templateId,
  );
  const assignedFieldIds = new Set(
    assignments.map((assignment: { fieldId: string }) => assignment.fieldId),
  );

  if (assignedFieldIds.has(fieldReference)) {
    return fieldReference;
  }

  const isUuidReference =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      fieldReference,
    );
  if (isUuidReference) {
    const directField = await services.decisionFieldService.getField(fieldReference);
    if (directField) {
      throw new Error(`Field ${directField.id} is not assigned to template ${context.templateId}`);
    }
  }

  const assignedFields = await Promise.all(
    assignments.map(async (assignment: { fieldId: string }) =>
      services.decisionFieldService.getField(assignment.fieldId),
    ),
  );
  const field =
    assignedFields.find(
      (assignedField: { name: string } | null) => assignedField?.name === fieldReference,
    ) ?? null;
  if (!field) {
    throw new Error(`Field ${fieldReference} not found`);
  }

  if (!assignedFieldIds.has(field.id)) {
    throw new Error(`Field ${field.id} is not assigned to template ${context.templateId}`);
  }

  return field.id;
}

// Create OpenAPI Hono app
const app = new OpenAPIHono();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Routes
app.openapi(getApiStatusRoute, async (c) => {
  const useMockLlm = process.env.NODE_ENV === "test" || process.env.USE_MOCK_LLM === "true";
  const provider = process.env.LLM_PROVIDER ?? "anthropic";
  const model = process.env.LLM_MODEL ?? "claude-opus-4-5";

  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    llm: {
      mode: useMockLlm ? "mock" : "real",
      provider,
      model,
    },
  });
});

app.openapi(getContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const context = await globalContextService.getContext();
  return c.json(context);
});

app.openapi(getInSessionMeetingsContextSummaryRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const [currentContext, meetings] = await Promise.all([
    globalContextService.getContext(),
    meetingService.findAll(),
  ]);

  return c.json({
    currentContext,
    inSessionMeetings: meetings.filter(
      (meeting: { status: string }) => meeting.status === "in_session",
    ),
  });
});

app.openapi(setMeetingContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { meetingId } = c.req.valid("json");
    await globalContextService.setActiveMeeting(meetingId);
    return c.json(await globalContextService.getContext());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(listDecisionFeedbackRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const items = await services.feedbackService.getFeedbackChain(id);
    return c.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(listFieldDecisionFeedbackRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id, fieldId } = c.req.valid("param");
    const items = await services.feedbackService.getFeedbackChain(id, fieldId);
    return c.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(createDecisionFeedbackRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const item = await services.feedbackService.addFeedback({
      ...data,
      decisionContextId: id,
    });
    return c.json(item, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(toggleDecisionFeedbackExcludeRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { feedbackId } = c.req.valid("param");
    const { excludeFromRegeneration } = c.req.valid("json");
    const item = await services.feedbackService.toggleExclude(
      feedbackId,
      excludeFromRegeneration,
    );
    return c.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(deleteDecisionFeedbackRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { feedbackId } = c.req.valid("param");
    await services.feedbackService.deleteFeedback(feedbackId);
    return c.body(null, 204);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(clearMeetingContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  await globalContextService.clearMeeting();
  return c.json(await globalContextService.getContext());
});

app.openapi(setDecisionContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const { flaggedDecisionId, templateId } = c.req.valid("json");
    await globalContextService.setActiveMeeting(id);
    const decisionContext = await globalContextService.setActiveDecision(
      flaggedDecisionId,
      templateId,
    );
    if (decisionContext.meetingId !== id) {
      return c.json({ error: "Flagged decision not found" }, 404);
    }

    return c.json(await globalContextService.getContext());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(clearDecisionContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await globalContextService.getContext();
  if (context.activeMeetingId !== undefined && context.activeMeetingId !== id) {
    return c.json({ error: "Active meeting does not match requested meeting" }, 400);
  }

  await globalContextService.clearDecision();
  return c.json(await globalContextService.getContext());
});

app.openapi(setFieldContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const { fieldId } = c.req.valid("json");
    const context = await globalContextService.getContext();
    if (context.activeMeetingId !== undefined && context.activeMeetingId !== id) {
      return c.json({ error: "Active meeting does not match requested meeting" }, 400);
    }

    await globalContextService.setActiveField(fieldId);
    return c.json(await globalContextService.getContext());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(clearFieldContextRoute, async (c) => {
  if (!globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await globalContextService.getContext();
  if (context.activeMeetingId !== undefined && context.activeMeetingId !== id) {
    return c.json({ error: "Active meeting does not match requested meeting" }, 400);
  }

  await globalContextService.clearField();
  return c.json(await globalContextService.getContext());
});

app.openapi(createMeetingRoute, async (c) => {
  try {
    const data = c.req.valid("json");
    const meeting = await meetingService.create(data);
    return c.json(meeting, 201);
  } catch (error) {
    console.error("Error creating meeting:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(listMeetingsRoute, async (c) => {
  const meetings = await meetingService.findAll();
  return c.json({ meetings });
});

app.openapi(getMeetingRoute, async (c) => {
  const { id } = c.req.valid("param");
  const meeting = await meetingService.findById(id);

  if (!meeting) {
    return c.json({ error: "Meeting not found" }, 404);
  }

  return c.json(meeting);
});

app.openapi(updateMeetingRoute, async (c) => {
  try {
    const { id } = c.req.valid("param");
    const { status, ...otherUpdates } = c.req.valid("json");
    const existingMeeting = await meetingService.findById(id);
    if (!existingMeeting) {
      return c.json({ error: "Meeting not found" }, 404);
    }

    if (status !== undefined) {
      const meeting = await meetingService.updateStatus(id, status);
      if (status === "ended" && globalContextService) {
        const context = await globalContextService.getContext();
        if (context.activeMeetingId === id) {
          await globalContextService.clearMeeting();
        }
      }

      if (otherUpdates.title === undefined && otherUpdates.participants === undefined) {
        return c.json(meeting);
      }
    }

    const updatePayload: {
      title?: string;
      date?: string;
      participants?: string[];
    } = {};

    if (otherUpdates.title !== undefined) {
      updatePayload.title = otherUpdates.title;
    }
    if (otherUpdates.date !== undefined) {
      updatePayload.date = otherUpdates.date;
    }
    if (otherUpdates.participants !== undefined) {
      updatePayload.participants = otherUpdates.participants;
    }

    if (Object.keys(updatePayload).length === 0) {
      return c.json(existingMeeting);
    }

    const meeting = await meetingService.update(id, updatePayload);
    if (status !== undefined && meeting.status !== status) {
      const updatedStatusMeeting = await meetingService.updateStatus(id, status);
      return c.json(updatedStatusMeeting);
    }

    return c.json(meeting);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(deleteMeetingRoute, async (c) => {
  try {
    const { id } = c.req.valid("param");
    const deleted = await meetingService.delete(id);

    if (!deleted) {
      return c.json({ error: "Meeting not found" }, 404);
    }

    return c.body(null, 204);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    if (isDependencyConflictErrorMessage(message)) {
      return c.json({ error: message }, 409);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(getMeetingSummaryRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const [decisions, contexts, stats] = await Promise.all([
    services.flaggedDecisionService.getDecisionsForMeeting(id),
    services.decisionContextService.getAllContextsForMeeting(id),
    services.decisionLogService.getMeetingDecisionStats(id),
  ]);

  return c.json({
    decisionCount: decisions.length,
    draftCount: contexts.filter((context: { status: string }) => context.status !== "logged")
      .length,
    loggedCount: stats.totalDecisions,
  });
});

app.openapi(listMeetingDecisionContextsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const contexts = await services.decisionContextService.getAllContextsForMeeting(id);
  return c.json({ contexts });
});

app.openapi(getMeetingTranscriptReadingRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const rows = await services.transcriptService.getReadableTranscriptRows(id);
  return c.json({ rows });
});

app.openapi(uploadTranscriptRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const uploadPayload: {
      meetingId: string;
      source: "upload";
      format: "json" | "txt" | "vtt" | "srt";
      content: string;
      metadata?: Record<string, any>;
      uploadedBy?: string;
    } = {
      meetingId: id,
      source: "upload",
      format: data.format,
      content: data.content,
    };
    if (data.metadata !== undefined) {
      uploadPayload.metadata = data.metadata;
    }
    if (data.uploadedBy !== undefined) {
      uploadPayload.uploadedBy = data.uploadedBy;
    }

    const transcript = await services.transcriptService.uploadTranscript(uploadPayload);
    const chunkOptions: {
      strategy: "fixed" | "semantic" | "speaker" | "streaming";
      maxTokens?: number;
      overlap?: number;
    } = {
      strategy: data.chunkStrategy,
    };
    if (data.chunkSize !== undefined) {
      chunkOptions.maxTokens = data.chunkSize;
    }
    if (data.overlap !== undefined) {
      chunkOptions.overlap = data.overlap;
    }

    const chunks = await services.transcriptService.processTranscript(transcript.id, chunkOptions);

    return c.json({ transcript, chunks }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(listRawTranscriptsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const transcripts = await services.transcriptService.getTranscriptsByMeeting(id);
  return c.json({ transcripts });
});

app.openapi(listMeetingChunksRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const chunks = await services.transcriptService.getChunksByMeeting(id);
  return c.json({ chunks });
});

app.openapi(searchChunksRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { meetingId, query } = c.req.valid("json");
    const chunks = await services.transcriptService.searchChunks(meetingId, query);
    return c.json({ chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(streamTranscriptRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services || !globalContextService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const event = c.req.valid("json");
  const globalContext = await globalContextService.getContext();
  const autoContexts = [`meeting:${id}`];

  if (globalContext.activeDecisionContextId) {
    autoContexts.push(`decision:${globalContext.activeDecisionContextId}`);
    if (globalContext.activeField) {
      autoContexts.push(
        `decision:${globalContext.activeDecisionContextId}:${globalContext.activeField}`,
      );
    }
  }

  const appliedContexts = Array.from(new Set([...autoContexts, ...(event.contexts ?? [])]));

  const streamEventData: {
    text: string;
    contexts: string[];
    speaker?: string;
    startTime?: string;
    sequenceNumber?: number;
  } = {
    text: event.text,
    contexts: appliedContexts,
  };

  if (event.speaker !== undefined) {
    streamEventData.speaker = event.speaker;
  }

  if (event.timestamp !== undefined) {
    streamEventData.startTime = event.timestamp;
  }

  if (event.sequenceNumber !== undefined) {
    streamEventData.sequenceNumber = event.sequenceNumber;
  }

  await services.transcriptService.addStreamEvent(id, {
    type: "text",
    data: streamEventData,
  });

  const status = await services.transcriptService.getStreamStatus(id);
  return c.json(
    {
      buffering: true,
      bufferSize: status.eventCount,
      appliedContexts,
    },
    201,
  );
});

app.openapi(getStreamingStatusRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const status = await services.transcriptService.getStreamStatus(id);
  return c.json({
    status: status.status as "active" | "idle" | "flushing",
    eventCount: status.eventCount,
  });
});

app.openapi(flushStreamingRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const chunks = await services.transcriptService.flushStream(id);
  return c.json({ chunks });
});

app.openapi(clearStreamingBufferRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  await services.transcriptService.clearStream(id);
  return c.body(null, 204);
});

app.openapi(listExpertsRoute, async (c) => {
  if (!expertTemplateService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const experts = await expertTemplateService.getAllTemplates();
  return c.json({ experts });
});

app.openapi(listMCPServersRoute, async (c) => {
  if (!mcpServerService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const servers = await mcpServerService.getAllServers();
  return c.json({ servers });
});

app.openapi(createSupplementaryContentRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const payload = c.req.valid("json");
    const options: {
      label?: string;
      contexts?: string[];
      createdBy?: string;
      sourceType?: string;
    } = {
      contexts: payload.contexts,
      sourceType: payload.sourceType,
    };

    if (payload.label !== undefined) {
      options.label = payload.label;
    }
    if (payload.createdBy !== undefined) {
      options.createdBy = payload.createdBy;
    }

    const item = await services.supplementaryContentService.add(
      payload.meetingId,
      payload.body,
      options,
    );
    return c.json(item, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(listSupplementaryContentRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { context } = c.req.valid("query");
    const items = await services.supplementaryContentService.listByContext(context);
    return c.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(deleteSupplementaryContentRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    await services.supplementaryContentService.remove(id);
    return c.body(null, 204);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(createFlaggedDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const createDecisionPayload: {
      meetingId: string;
      suggestedTitle: string;
      contextSummary: string;
      confidence: number;
      chunkIds: string[];
      suggestedTemplateId?: string;
      templateConfidence?: number;
      priority: number;
    } = {
      meetingId: id,
      suggestedTitle: data.suggestedTitle,
      contextSummary: data.contextSummary,
      confidence: data.confidence,
      chunkIds: data.chunkIds,
      priority: data.priority,
    };
    if (data.suggestedTemplateId !== undefined) {
      createDecisionPayload.suggestedTemplateId = data.suggestedTemplateId;
    }
    if (data.templateConfidence !== undefined) {
      createDecisionPayload.templateConfidence = data.templateConfidence;
    }

    const decision =
      await services.flaggedDecisionService.createFlaggedDecision(createDecisionPayload);

    return c.json(decision, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(listFlaggedDecisionsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const { status } = c.req.valid("query");
  const decisions = await services.flaggedDecisionService.getDecisionsForMeeting(id);
  const filtered = status
    ? decisions.filter((decision: { status: string }) => decision.status === status)
    : decisions;
  const enriched = await Promise.all(
    filtered.map(async (decision) => {
      const context = await services.decisionContextService.getContextByFlaggedDecision(
        decision.id,
      );
      const draftFieldCount = Object.keys(context?.draftData ?? {}).filter(
        (key) => key !== "__fieldMeta",
      ).length;
      return {
        ...decision,
        contextId: context?.id ?? null,
        contextStatus: context?.status ?? null,
        hasDraft: draftFieldCount > 0,
        draftFieldCount,
        versionCount: context?.draftVersions?.length ?? 0,
      };
    }),
  );
  return c.json({ decisions: enriched });
});

app.openapi(updateFlaggedDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const updatePayload: {
      suggestedTitle?: string;
      contextSummary?: string;
      status?: "pending" | "accepted" | "rejected" | "dismissed";
      priority?: number;
      chunkIds?: string[];
    } = {};

    if (data.suggestedTitle !== undefined) {
      updatePayload.suggestedTitle = data.suggestedTitle;
    }
    if (data.contextSummary !== undefined) {
      updatePayload.contextSummary = data.contextSummary;
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }
    if (data.priority !== undefined) {
      updatePayload.priority = data.priority;
    }
    if (data.chunkIds !== undefined) {
      updatePayload.chunkIds = data.chunkIds;
    }

    const decision = await services.flaggedDecisionService.updateDecision(id, updatePayload);

    if (!decision) {
      return c.json({ error: "Flagged decision not found" }, 404);
    }

    return c.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(deleteFlaggedDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const deleted = await services.flaggedDecisionService.deleteDecision(id);

  if (!deleted) {
    return c.json({ error: "Decision not found" }, 404);
  }

  return c.body(null, 204);
});

app.openapi(getDecisionContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextService.getById(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(updateDecisionContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const data = c.req.valid("json");
  const context = await services.decisionContextService.updateMeta(id, data);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(getFlaggedDecisionContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextService.getContextByFlaggedDecision(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(listTemplateFieldsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services || !decisionTemplateService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const template = await decisionTemplateService.getTemplate(id);
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  const assignments = await services.templateFieldAssignmentRepository.findByTemplateId(id);
  const fields = await Promise.all(
    assignments
      .sort((a, b) => a.order - b.order)
      .map(async (assignment) => services.decisionFieldService.getField(assignment.fieldId)),
  );

  return c.json({
    fields: fields.filter((field): field is NonNullable<typeof field> => field !== null),
  });
});

app.openapi(listTemplatesRoute, async (c) => {
  if (!decisionTemplateService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const templates = await decisionTemplateService.getAllTemplates();
  return c.json({ templates });
});

app.openapi(listTemplateExportTemplatesRoute, async (c) => {
  if (!decisionTemplateService || !exportTemplateService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const template = await decisionTemplateService.getTemplate(id);
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  const exportTemplates = await exportTemplateService.getExportTemplatesForDeliberationTemplate(id);
  return c.json({ exportTemplates });
});

app.openapi(createDecisionContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const data = c.req.valid("json");
    const context = await services.decisionContextService.createContext(data);
    return c.json(context, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: message }, 400);
  }
});

app.openapi(changeDecisionContextTemplateRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services || !decisionTemplateService) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const { templateId } = c.req.valid("json");
  const template = await decisionTemplateService.getTemplate(templateId);
  if (!template) {
    return c.json({ error: "Template not found" }, 404);
  }

  const context = await services.decisionContextService.changeTemplate(id, templateId);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(listDecisionContextWindowsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextRepository.findById(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  const windows = await services.transcriptService.getContextWindows(id);
  return c.json({ windows });
});

app.openapi(createDecisionContextWindowRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextRepository.findById(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  const body = c.req.valid("json");
  const window = await services.transcriptService.createContextWindow(
    id,
    body.selectionStrategy,
    body.usedFor,
  );
  return c.json(window, 201);
});

app.openapi(previewDecisionContextWindowRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextRepository.findById(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  const query = c.req.valid("query");
  const preview = await services.transcriptService.previewContextWindow(
    id,
    query.strategy,
    query.limit,
  );
  return c.json(preview);
});

app.openapi(generateDraftRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const context = await services.draftGenerationService.generateDraft(id);
    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(regenerateDraftRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const context = await services.draftGenerationService.generateDraft(id);
    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(exportMarkdownRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const query = c.req.valid("query");
    const exportOptions: {
      exportTemplateId?: string;
      includeMetadata?: boolean;
      includeTimestamps?: boolean;
      includeParticipants?: boolean;
      fieldOrder?: "template" | "alphabetical";
      lockedFieldIndicator?: "prefix" | "suffix" | "none";
    } = {};
    if (query.exportTemplateId !== undefined) {
      exportOptions.exportTemplateId = query.exportTemplateId;
    }
    if (query.includeMetadata !== undefined) {
      exportOptions.includeMetadata = query.includeMetadata;
    }
    if (query.includeTimestamps !== undefined) {
      exportOptions.includeTimestamps = query.includeTimestamps;
    }
    if (query.includeParticipants !== undefined) {
      exportOptions.includeParticipants = query.includeParticipants;
    }
    if (query.fieldOrder !== undefined) {
      exportOptions.fieldOrder = query.fieldOrder;
    }
    if (query.lockedFieldIndicator !== undefined) {
      exportOptions.lockedFieldIndicator = query.lockedFieldIndicator;
    }

    const markdown = await services.markdownExportService.exportToMarkdown(id, exportOptions);
    return c.json({ markdown });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(lockFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const { fieldId } = c.req.valid("json");
  const context = await services.decisionContextService.lockField(id, fieldId);

  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(unlockFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const { fieldId } = c.req.valid("json");
  const context = await services.decisionContextService.unlockField(id, fieldId);

  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  return c.json(context);
});

app.openapi(listDraftVersionsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const context = await services.decisionContextRepository.findById(id);
  if (!context) {
    return c.json({ error: "Decision context not found" }, 404);
  }

  const versions = await services.decisionContextService.listVersions(id);
  return c.json({ versions });
});

app.openapi(rollbackDraftRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const { version } = c.req.valid("json");
    const context = await services.decisionContextService.rollback(id, version);
    if (!context) {
      return c.json({ error: "Decision context not found" }, 404);
    }

    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(regenerateFieldRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id, fieldId } = c.req.valid("param");
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const value = await services.draftGenerationService.regenerateField(id, resolvedFieldId);
    return c.json({ value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(updateFieldValueRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id, fieldId } = c.req.valid("param");
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const { value } = c.req.valid("json");
    const context = await services.decisionContextService.setFieldValue(id, resolvedFieldId, value);

    if (!context) {
      return c.json({ error: "Decision context not found" }, 404);
    }

    return c.json(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(getFieldTranscriptRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id, fieldId } = c.req.valid("param");
  try {
    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const chunks = await services.transcriptService.getChunksByContext(
      `decision:${id}:${resolvedFieldId}`,
    );
    return c.json({ chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(assignDecisionTranscriptContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const { chunkIds } = c.req.valid("json");

  try {
    const context = await services.decisionContextRepository.findById(id);
    if (!context) {
      return c.json({ error: "Decision context not found" }, 404);
    }

    const chunks = await services.transcriptService.assignContextsToChunks({
      meetingId: context.meetingId,
      chunkIds,
      contexts: [`decision:${id}`],
    });
    return c.json({ chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(assignFieldTranscriptContextRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id, fieldId } = c.req.valid("param");
  const { chunkIds } = c.req.valid("json");

  try {
    const context = await services.decisionContextRepository.findById(id);
    if (!context) {
      return c.json({ error: "Decision context not found" }, 404);
    }

    const resolvedFieldId = await resolveContextFieldId(services, id, fieldId);
    const chunks = await services.transcriptService.assignContextsToChunks({
      meetingId: context.meetingId,
      chunkIds,
      contexts: [`decision:${id}`, `decision:${id}:${resolvedFieldId}`],
    });
    return c.json({ chunks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(logDecisionRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const payload = c.req.valid("json");

    // Auto-advance context status to 'locked' if it is still in drafting/reviewing.
    // This avoids requiring separate submit + approve API calls for the common case
    // where the user has locked all fields and simply wants to log the decision.
    const ctx = await services.decisionContextService.getById(id);
    if (ctx && ctx.status === "drafting") {
      const reviewed = await services.decisionContextService.submitForReview(id);
      if (reviewed && reviewed.status === "reviewing") {
        await services.decisionContextService.approveAndLock(id);
      }
    } else if (ctx && ctx.status === "reviewing") {
      await services.decisionContextService.approveAndLock(id);
    }

    const decision = await services.decisionLogGenerator.logDecision(id, {
      loggedBy: payload.loggedBy,
      decisionMethod:
        payload.decisionMethod.details === undefined
          ? { type: payload.decisionMethod.type }
          : {
              type: payload.decisionMethod.type,
              details: payload.decisionMethod.details,
            },
    });
    if (!decision) {
      return c.json({ error: "Decision context not found" }, 404);
    }

    return c.json(decision);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(getDecisionLogRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const decision = await services.decisionLogService.getDecisionLog(id);
  if (!decision) {
    return c.json({ error: "Decision log not found" }, 404);
  }

  return c.json(decision);
});

app.openapi(exportDecisionLogRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  try {
    const { id } = c.req.valid("param");
    const { format } = c.req.valid("query");
    const decision = await services.decisionLogService.getDecisionLog(id);

    if (!decision) {
      return c.json({ error: "Decision log not found" }, 404);
    }

    const content =
      format === "json"
        ? decision
        : await services.markdownExportService.exportToMarkdown(decision.decisionContextId);

    return c.json({ format, content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (isNotFoundErrorMessage(message)) {
      return c.json({ error: message }, 404);
    }

    return c.json({ error: message }, 400);
  }
});

app.openapi(listLLMInteractionsRoute, async (c) => {
  const services = getWorkflowServices();
  if (!services) {
    return c.json({ error: "This endpoint requires DATABASE_URL to be configured" }, 503);
  }

  const { id } = c.req.valid("param");
  const interactions = await services.llmInteractionService.findByDecisionContext(id);
  return c.json({ interactions });
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// OpenAPI documentation
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "μ democracy API",
    description: "Context-driven decision logging system API",
  },
});

// Swagger UI
app.get("/docs", (c) => {
  return c.html(`
<!DOCTYPE html>
<html>
<head>
  <title>μ democracy API</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>
  `);
});

export { app };
export default app;

// Start server if not imported (direct run)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const port = process.env.PORT || 3000;
  console.log(`Server starting on port ${port}...`);

  // Use Node.js http server with Hono's fetch handler
  const server = (await import("http")).createServer(async (req, res) => {
    // Read request body
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    // Convert Node request to Web Request
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const headers = new Headers(
      Object.entries(req.headers)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, v]) as [string, string][],
    );

    const request = new Request(url, {
      method: req.method || "GET",
      headers,
      body: body.length > 0 ? body : null,
    });

    // Call Hono app
    const response = await app.fetch(request);

    // Convert Web Response to Node response
    res.statusCode = response.status;
    res.statusMessage = response.statusText;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const responseBody = await response.text();
    res.end(responseBody);
  });

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}
