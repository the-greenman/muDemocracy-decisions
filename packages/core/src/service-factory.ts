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
import { VercelAILLMService } from './llm/vercel-ai-llm-service';

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

/**
 * Creates a DecisionLogService with real repositories
 */
export function createDecisionLogService(): DecisionLogService {
  return new DecisionLogService(
    new DrizzleDecisionLogRepository(),
    new DrizzleDecisionContextRepository()
  );
}

/**
 * Creates a DecisionContextService with real repositories
 */
export function createDecisionContextService(): DecisionContextService {
  return new DecisionContextService(
    new DrizzleDecisionContextRepository()
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
  );
}

/**
 * Creates a FlaggedDecisionService with real repositories
 */
export function createFlaggedDecisionService(): FlaggedDecisionService {
  return new FlaggedDecisionService(
    new DrizzleFlaggedDecisionRepository()
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
 * Service container for all services
 */
export interface ServiceContainer {
  meetingService: MeetingService;
  decisionLogService: DecisionLogService;
  decisionContextService: DecisionContextService;
  transcriptService: TranscriptService;
  decisionFieldService: DecisionFieldService;
  draftGenerationService: DraftGenerationService;
  flaggedDecisionService: FlaggedDecisionService;
  decisionTemplateService: DecisionTemplateService;
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
    decisionFieldService: createDecisionFieldService(),
    draftGenerationService: createDraftGenerationService(),
    flaggedDecisionService: createFlaggedDecisionService(),
    decisionTemplateService: createDecisionTemplateService(),
  };
}
