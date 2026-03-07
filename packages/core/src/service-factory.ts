/**
 * Service Factory - Provides properly configured service instances
 * 
 * This factory encapsulates the dependency injection wiring and prevents
 * leaking repository implementations into application layers.
 */

import { MeetingService } from './services/meeting-service';
import { DecisionLogService } from './services/decision-log-service';
import { DecisionContextService } from './services/decision-context-service';
import { TranscriptService } from './services/transcript-service';
import { DecisionFieldService } from './services/decision-field-service';
import { DraftGenerationService } from './services/draft-generation-service';
import { FlaggedDecisionService } from './services/flagged-decision-service';
import { DecisionTemplateService } from './services/decision-template-service';
import { GlobalContextService, FileGlobalContextStore } from './services/global-context-service';
import { LLMInteractionService } from './services/llm-interaction-service';
import { MarkdownExportService } from './services/markdown-export-service';
import { VercelAILLMService } from './llm/vercel-ai-llm-service';
import type { ITranscriptManager } from './transcript-manager';
import type { IDecisionLogGenerator } from './decision-log-generator/i-decision-log-generator';
import type { IContentCreator } from './decision-log-generator/i-content-creator';
import { InProcessEventBus } from './events/in-process-event-bus';
import type { IEventBus } from './events/i-event-bus';

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
  DrizzleFlaggedDecisionRepository,
  DrizzleDecisionTemplateRepository,
} from '@repo/db';

/**
 * Creates a MeetingService with real repositories
 */
export function createMeetingService(): MeetingService {
  return new MeetingService(
    new DrizzleMeetingRepository()
  );
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
    new DrizzleTemplateFieldAssignmentRepository()
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
    new DrizzleDecisionContextWindowRepository()
  );
}

/**
 * Creates a DecisionFieldService with real repositories
 */
export function createDecisionFieldService(): DecisionFieldService {
  return new DecisionFieldService(
    new DrizzleDecisionFieldRepository()
  );
}

/**
 * Creates a DraftGenerationService with real repositories and the Vercel AI LLM backend.
 */
export function createDraftGenerationService(): DraftGenerationService {
  return new DraftGenerationService(
    new VercelAILLMService(),
    new DrizzleTranscriptChunkRepository(),
    new DrizzleTemplateFieldAssignmentRepository(),
    new DrizzleDecisionFieldRepository(),
    new DrizzleDecisionContextRepository(),
    new DrizzleLLMInteractionRepository(),
    new DrizzleFlaggedDecisionRepository()
  );
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
    new DrizzleTranscriptChunkRepository()
  );
}

/**
 * Creates a DecisionTemplateService with real repositories
 */
export function createDecisionTemplateService(): DecisionTemplateService {
  return new DecisionTemplateService(
    new DrizzleDecisionTemplateRepository(),
    new DrizzleTemplateFieldAssignmentRepository()
  );
}

/**
 * Creates a GlobalContextService with file-backed persistence for CLI usage.
 */
export function createGlobalContextService(): GlobalContextService {
  return new GlobalContextService(
    new FileGlobalContextStore(),
    new DrizzleMeetingRepository(),
    new FlaggedDecisionService(
      new DrizzleFlaggedDecisionRepository(),
      new DrizzleTranscriptChunkRepository()
    ),
    new DecisionContextService(
      new DrizzleDecisionContextRepository(),
      new DrizzleTemplateFieldAssignmentRepository()
    ),
    new DecisionTemplateService(
      new DrizzleDecisionTemplateRepository(),
      new DrizzleTemplateFieldAssignmentRepository()
    )
  );
}

/**
 * Creates an LLMInteractionService with real repository
 */
export function createLLMInteractionService(): LLMInteractionService {
  return new LLMInteractionService(
    new DrizzleLLMInteractionRepository()
  );
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
    new DrizzleMeetingRepository()
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
  contentCreator: IContentCreator;
  flaggedDecisionService: FlaggedDecisionService;
  decisionTemplateService: DecisionTemplateService;
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
    contentCreator: createContentCreator(),
    flaggedDecisionService: createFlaggedDecisionService(),
    decisionTemplateService: createDecisionTemplateService(),
    globalContextService: createGlobalContextService(),
    decisionLogGenerator: createDecisionLogGenerator(),
    eventBus: createEventBus(),
  };
}
