/**
 * Service Factory - Provides properly configured service instances
 *
 * This factory encapsulates the dependency injection wiring and prevents
 * leaking repository implementations into application layers.
 */

import { MeetingService } from "./services/meeting-service.js";
import { DecisionLogService } from "./services/decision-log-service.js";
import { DecisionContextService } from "./services/decision-context-service.js";
import { TranscriptService } from "./services/transcript-service.js";
import { DecisionFieldService } from "./services/decision-field-service.js";
import { DraftGenerationService } from "./services/draft-generation-service.js";
import { FlaggedDecisionService } from "./services/flagged-decision-service.js";
import { DecisionTemplateService } from "./services/decision-template-service.js";
import { ExportTemplateService } from "./services/export-template-service.js";
import { ExpertTemplateService } from "./services/expert-template-service.js";
import { GlobalContextService } from "./services/global-context-service.js";
import { LLMInteractionService } from "./services/llm-interaction-service.js";
import { MarkdownExportService } from "./services/markdown-export-service.js";
import { MCPServerService } from "./services/mcp-server-service.js";
import { SupplementaryContentService } from "./services/supplementary-content-service.js";
import { FeedbackService } from "./services/feedback-service.js";
import { MockLLMService } from "./llm/mock-llm-service.js";
import { VercelAILLMService } from "./llm/vercel-ai-llm-service.js";
import type { ITranscriptManager } from "./transcript-manager/index.js";
import type { IDecisionLogGenerator } from "./decision-log-generator/i-decision-log-generator.js";
import type { IContentCreator } from "./decision-log-generator/i-content-creator.js";
import { InProcessEventBus } from "./events/in-process-event-bus.js";
import type { IEventBus } from "./events/i-event-bus.js";

// Import repository implementations from db package
import {
  DrizzleMeetingRepository,
  DrizzleDecisionLogRepository,
  DrizzleDecisionContextRepository,
  DrizzleRawTranscriptRepository,
  DrizzleTranscriptChunkRepository,
  DrizzleStreamingBufferRepository,
  DrizzleChunkRelevanceRepository,
  DrizzleDecisionContextWindowRepository,
  DrizzleDecisionFieldRepository,
  DrizzleLLMInteractionRepository,
  DrizzleTemplateFieldAssignmentRepository,
  DrizzleExportTemplateFieldAssignmentRepository,
  DrizzleExportTemplateRepository,
  DrizzleFlaggedDecisionRepository,
  DrizzleDecisionTemplateRepository,
  DrizzleExpertTemplateRepository,
  DrizzleMCPServerRepository,
  DrizzleFeedbackRepository,
  DrizzleSupplementaryContentRepository,
  DrizzleConnectionRepository,
} from "@repo/db";

function shouldUseMockLlm(): boolean {
  return process.env.NODE_ENV === "test" || process.env.USE_MOCK_LLM === "true";
}

function createLlmService(): MockLLMService | VercelAILLMService {
  return shouldUseMockLlm() ? new MockLLMService() : new VercelAILLMService();
}

/**
 * Creates a MeetingService with real repositories
 */
export function createMeetingService(): MeetingService {
  return new MeetingService(new DrizzleMeetingRepository());
}

export function createTranscriptManager(): ITranscriptManager {
  const transcriptService = createTranscriptService();

  return {
    uploadTranscript: transcriptService.uploadTranscript.bind(transcriptService),
    getTranscriptsByMeeting: transcriptService.getTranscriptsByMeeting.bind(transcriptService),
    addTranscriptText: transcriptService.addTranscriptText.bind(transcriptService),
    addChunk: transcriptService.addChunk.bind(transcriptService),
    getChunksByMeeting: transcriptService.getChunksByMeeting.bind(transcriptService),
    getChunksByContext: transcriptService.getChunksByContext.bind(transcriptService),
    searchChunks: transcriptService.searchChunks.bind(transcriptService),
    processTranscript: transcriptService.processTranscript.bind(transcriptService),
    addStreamEvent: transcriptService.addStreamEvent.bind(transcriptService),
    getStreamStatus: transcriptService.getStreamStatus.bind(transcriptService),
    flushStream: transcriptService.flushStream.bind(transcriptService),
    clearStream: transcriptService.clearStream.bind(transcriptService),
    tagChunkRelevance: transcriptService.tagChunkRelevance.bind(transcriptService),
    createContextWindow: transcriptService.createContextWindow.bind(transcriptService),
    getContextWindows: transcriptService.getContextWindows.bind(transcriptService),
    previewContextWindow: transcriptService.previewContextWindow.bind(transcriptService),
  };
}

/**
 * Creates a DecisionLogService with real repositories
 */
export function createDecisionLogService(): DecisionLogService {
  return new DecisionLogService(
    new DrizzleDecisionLogRepository(),
    new DrizzleDecisionContextRepository(),
    new DrizzleDecisionTemplateRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
    new DrizzleChunkRelevanceRepository(),
  );
}

export function createDecisionLogGenerator(): IDecisionLogGenerator {
  const decisionLogService = createDecisionLogService();

  return {
    logDecision: decisionLogService.logDecision.bind(decisionLogService),
  };
}

/**
 * Creates a DecisionContextService with real repositories
 */
export function createDecisionContextService(): DecisionContextService {
  return new DecisionContextService(
    new DrizzleDecisionContextRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
  );
}

/**
 * Creates a TranscriptService with real repositories
 */
export function createTranscriptService(): TranscriptService {
  return new TranscriptService(
    new DrizzleRawTranscriptRepository(),
    new DrizzleTranscriptChunkRepository(),
    new DrizzleStreamingBufferRepository(),
    new DrizzleChunkRelevanceRepository(),
    new DrizzleDecisionContextWindowRepository(),
  );
}

/**
 * Creates a DecisionFieldService with real repositories
 */
export function createDecisionFieldService(): DecisionFieldService {
  return new DecisionFieldService(new DrizzleDecisionFieldRepository());
}

/**
 * Creates a DraftGenerationService with real repositories and the Vercel AI LLM backend.
 */
export function createDraftGenerationService(): DraftGenerationService {
  return new DraftGenerationService(
    createLlmService(),
    new DrizzleTranscriptChunkRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
    new DrizzleDecisionFieldRepository(),
    new DrizzleDecisionContextRepository(),
    new DrizzleLLMInteractionRepository(),
    new DrizzleFlaggedDecisionRepository(),
    new DrizzleSupplementaryContentRepository(),
    new DrizzleDecisionTemplateRepository(),
    new DrizzleFeedbackRepository(),
  );
}

export function createSupplementaryContentService(): SupplementaryContentService {
  return new SupplementaryContentService(new DrizzleSupplementaryContentRepository());
}

export function createFeedbackService(): FeedbackService {
  return new FeedbackService(new DrizzleFeedbackRepository());
}

export function createContentCreator(): IContentCreator {
  const draftGenerationService = createDraftGenerationService();
  const markdownExportService = createMarkdownExportService();

  return {
    generateDraft: draftGenerationService.generateDraft.bind(draftGenerationService),
    regenerateField: draftGenerationService.regenerateField.bind(draftGenerationService),
    exportMarkdown: markdownExportService.exportToMarkdown.bind(markdownExportService),
  };
}

/**
 * Creates a FlaggedDecisionService with real repositories
 */
export function createFlaggedDecisionService(): FlaggedDecisionService {
  return new FlaggedDecisionService(
    new DrizzleFlaggedDecisionRepository(),
    new DrizzleTranscriptChunkRepository(),
  );
}

/**
 * Creates a DecisionTemplateService with real repositories
 */
export function createDecisionTemplateService(): DecisionTemplateService {
  return new DecisionTemplateService(
    new DrizzleDecisionTemplateRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
  );
}

export function createExpertTemplateService(): ExpertTemplateService {
  return new ExpertTemplateService(new DrizzleExpertTemplateRepository());
}

export function createMCPServerService(): MCPServerService {
  return new MCPServerService(new DrizzleMCPServerRepository());
}

/**
 * Creates a GlobalContextService backed by the PostgreSQL connections table.
 */
export function createGlobalContextService(): GlobalContextService {
  return new GlobalContextService(
    new DrizzleConnectionRepository(),
    new DrizzleMeetingRepository(),
    new FlaggedDecisionService(
      new DrizzleFlaggedDecisionRepository(),
      new DrizzleTranscriptChunkRepository(),
    ),
    new DecisionContextService(
      new DrizzleDecisionContextRepository(),
      new DrizzleTemplateFieldAssignmentRepository(),
    ),
    new DecisionTemplateService(
      new DrizzleDecisionTemplateRepository(),
      new DrizzleTemplateFieldAssignmentRepository(),
    ),
  );
}

/**
 * Creates an LLMInteractionService with real repository
 */
export function createLLMInteractionService(): LLMInteractionService {
  return new LLMInteractionService(new DrizzleLLMInteractionRepository());
}

export function createEventBus(): IEventBus {
  return new InProcessEventBus();
}

/**
 * Creates a DecisionContextRepository
 */
export function createDecisionContextRepository(): DrizzleDecisionContextRepository {
  return new DrizzleDecisionContextRepository();
}

/**
 * Creates a DecisionTemplateRepository
 */
export function createDecisionTemplateRepository(): DrizzleDecisionTemplateRepository {
  return new DrizzleDecisionTemplateRepository();
}

/**
 * Creates a DecisionFieldRepository
 */
export function createDecisionFieldRepository(): DrizzleDecisionFieldRepository {
  return new DrizzleDecisionFieldRepository();
}

/**
 * Creates a TemplateFieldAssignmentRepository
 */
export function createTemplateFieldAssignmentRepository(): DrizzleTemplateFieldAssignmentRepository {
  return new DrizzleTemplateFieldAssignmentRepository();
}

/**
 * Creates a MarkdownExportService with real repositories
 */
export function createMarkdownExportService(): MarkdownExportService {
  return new MarkdownExportService(
    new DrizzleDecisionContextRepository(),
    new DrizzleDecisionTemplateRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
    new DrizzleDecisionFieldRepository(),
    new DrizzleMeetingRepository(),
    new ExportTemplateService(
      new DrizzleDecisionTemplateRepository(),
      new DrizzleTemplateFieldAssignmentRepository(),
      new DrizzleExportTemplateRepository(),
      new DrizzleExportTemplateFieldAssignmentRepository(),
    ),
  );
}

export function createExportTemplateService(): ExportTemplateService {
  return new ExportTemplateService(
    new DrizzleDecisionTemplateRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
    new DrizzleExportTemplateRepository(),
    new DrizzleExportTemplateFieldAssignmentRepository(),
  );
}

/**
 * Service container for all services
 */
export interface ServiceContainer {
  meetingService: MeetingService;
  decisionLogService: DecisionLogService;
  decisionContextService: DecisionContextService;
  transcriptService: TranscriptService;
  transcriptManager: ITranscriptManager;
  decisionFieldService: DecisionFieldService;
  draftGenerationService: DraftGenerationService;
  supplementaryContentService: SupplementaryContentService;
  feedbackService: FeedbackService;
  contentCreator: IContentCreator;
  flaggedDecisionService: FlaggedDecisionService;
  decisionTemplateService: DecisionTemplateService;
  exportTemplateService: ExportTemplateService;
  globalContextService: GlobalContextService;
  decisionLogGenerator: IDecisionLogGenerator;
  eventBus: IEventBus;
}

/**
 * Creates a container with all services
 */
export function createServices(): ServiceContainer {
  return {
    meetingService: createMeetingService(),
    decisionLogService: createDecisionLogService(),
    decisionContextService: createDecisionContextService(),
    transcriptService: createTranscriptService(),
    transcriptManager: createTranscriptManager(),
    decisionFieldService: createDecisionFieldService(),
    draftGenerationService: createDraftGenerationService(),
    supplementaryContentService: createSupplementaryContentService(),
    feedbackService: createFeedbackService(),
    contentCreator: createContentCreator(),
    flaggedDecisionService: createFlaggedDecisionService(),
    decisionTemplateService: createDecisionTemplateService(),
    exportTemplateService: createExportTemplateService(),
    globalContextService: createGlobalContextService(),
    decisionLogGenerator: createDecisionLogGenerator(),
    eventBus: createEventBus(),
  };
}
