/**
 * Service Factory - Provides properly configured service instances
 * 
 * This factory encapsulates the dependency injection wiring and prevents
 * leaking repository implementations into application layers.
 */

import { DecisionLogService } from './services/decision-log-service';
import { DecisionContextService } from './services/decision-context-service';
import { TranscriptService } from './services/transcript-service';
import { DecisionFieldService } from './services/decision-field-service';

// Import repository implementations from db package
import {
  DrizzleDecisionLogRepository,
  DrizzleDecisionContextRepository,
  DrizzleRawTranscriptRepository,
  DrizzleTranscriptChunkRepository,
  DrizzleStreamingBufferRepository,
  DrizzleChunkRelevanceRepository,
  DrizzleDecisionContextWindowRepository,
  DrizzleDecisionFieldRepository
} from '@repo/db';

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
 * Service container for all services
 */
export interface ServiceContainer {
  decisionLogService: DecisionLogService;
  decisionContextService: DecisionContextService;
  transcriptService: TranscriptService;
  decisionFieldService: DecisionFieldService;
}

/**
 * Creates a container with all services
 */
export function createServices(): ServiceContainer {
  return {
    decisionLogService: createDecisionLogService(),
    decisionContextService: createDecisionContextService(),
    transcriptService: createTranscriptService(),
    decisionFieldService: createDecisionFieldService()
  };
}
