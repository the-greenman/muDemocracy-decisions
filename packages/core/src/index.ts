// Services
export { MeetingService } from './services/meeting-service';
export { TranscriptService } from './services/transcript-service';
export { FlaggedDecisionService } from './services/flagged-decision-service';
export { DecisionContextService } from './services/decision-context-service';
export { DecisionLogService } from './services/decision-log-service';
export { DecisionFieldService } from './services/decision-field-service';

// Service Factory
export { 
  createDecisionLogService, 
  createDecisionContextService, 
  createTranscriptService,
  createDecisionFieldService,
  createServices,
  type ServiceContainer 
} from './service-factory';

// Logger
export { Logger, logger, withContext, getContext, getCorrelationId, addContext, correlationMiddleware } from './logger';
export type { LogContext, LoggerConfig, LogLevel, RedactionOptions } from './logger';

// Interfaces
export type { IMeetingRepository } from './interfaces/i-meeting-repository';
export type { IFlaggedDecisionRepository } from './interfaces/i-flagged-decision-repository';
export type { IFlaggedDecisionService } from './interfaces/i-flagged-decision-service';
export type { IDecisionContextRepository, CreateDecisionContext } from './interfaces/i-decision-context-repository';
export type { IDecisionContextService } from './interfaces/i-decision-context-service';
export type { IDecisionLogRepository } from './interfaces/i-decision-log-repository';
export type { IDecisionLogService } from './interfaces/i-decision-log-service';
export type { IDecisionFieldRepository } from './interfaces/i-decision-field-repository';
export type { IDecisionFieldService } from './interfaces/i-decision-field-service';
export type {
  IRawTranscriptRepository,
  ITranscriptChunkRepository,
  IStreamingBufferRepository,
  IChunkRelevanceRepository,
  IDecisionContextWindowRepository,
} from './interfaces/transcript-repositories';

// Re-export types from schema for convenience
export type { Meeting, CreateMeeting, UpdateMeeting } from '@repo/schema';
export type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
export type { DecisionContext } from '@repo/schema';
export type { DecisionLog, CreateDecisionLog } from '@repo/schema';
export type { DecisionField, CreateDecisionField } from '@repo/schema';
