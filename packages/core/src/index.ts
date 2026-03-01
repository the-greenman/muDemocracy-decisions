// LLM
export type { ILLMService, GuidanceSegment, GenerateDraftParams, RegenerateFieldParams, DraftResult } from './llm';
export type { PromptSegment } from './llm';
export { PromptBuilder, MockLLMService, VercelAILLMService } from './llm';

// Services
export { MeetingService } from './services/meeting-service';
export { TranscriptService } from './services/transcript-service';
export { FlaggedDecisionService } from './services/flagged-decision-service';
export { DecisionContextService } from './services/decision-context-service';
export { DecisionLogService } from './services/decision-log-service';
export { DecisionFieldService } from './services/decision-field-service';
export { DecisionTemplateService } from './services/decision-template-service';
export { ExpertTemplateService } from './services/expert-template-service';
export { MCPServerService } from './services/mcp-server-service';
export { ExpertAdviceService } from './services/expert-advice-service';
export { DraftGenerationService } from './services/draft-generation-service';

// Service Factory
export {
  createMeetingService,
  createDecisionLogService,
  createDecisionContextService,
  createTranscriptService,
  createDecisionFieldService,
  createDraftGenerationService,
  createServices,
  type ServiceContainer
} from './service-factory';

// Logger
export { Logger, logger, withContext, getContext, getCorrelationId, addContext, correlationMiddleware } from './logger';
export type { LogContext, LoggerConfig, LogLevel, RedactionOptions } from './logger';

// Interfaces
export type { IMeetingRepository } from './interfaces/i-meeting-repository';
export type { ILLMInteractionRepository } from './interfaces/i-llm-interaction-repository';
export type { IFlaggedDecisionRepository } from './interfaces/i-flagged-decision-repository';
export type { IFlaggedDecisionService } from './interfaces/i-flagged-decision-service';
export type { IDecisionContextRepository } from './interfaces/i-decision-context-repository';
export type { IDecisionContextService } from './interfaces/i-decision-context-service';
export type { IDecisionLogRepository } from './interfaces/i-decision-log-repository';
export type { IDecisionLogService } from './interfaces/i-decision-log-service';
export type { IDecisionFieldRepository } from './interfaces/i-decision-field-repository';
export type { IDecisionFieldService } from './interfaces/i-decision-field-service';
export type { 
  IDecisionTemplateRepository,
  ITemplateFieldAssignmentRepository 
} from './interfaces/i-decision-template-repository';
export type { IDecisionTemplateService } from './interfaces/i-decision-template-service';
export type {
  IExpertTemplateRepository
} from './interfaces/i-expert-template-repository';
export type {
  IExpertTemplateService
} from './services/expert-template-service';
export type {
  IMCPServerService
} from './services/mcp-server-service';
export type {
  IExpertAdviceService
} from './services/expert-advice-service';
export type {
  IRawTranscriptRepository,
  ITranscriptChunkRepository,
  IStreamingBufferRepository,
  IChunkRelevanceRepository,
  IDecisionContextWindowRepository,
} from './interfaces/transcript-repositories';

// Re-export types from schema for convenience
export type { Meeting, CreateMeeting, UpdateMeeting } from '@repo/schema';
export type { DecisionLog, CreateDecisionLog } from '@repo/schema';
export type { DecisionContext, CreateDecisionContext } from '@repo/schema';
export type { DecisionField, CreateDecisionField } from '@repo/schema';
export type { DecisionTemplate, CreateDecisionTemplate } from '@repo/schema';
export type { TemplateFieldAssignment, CreateTemplateFieldAssignment } from '@repo/schema';
export type { ExpertTemplate, CreateExpertTemplate, UpdateExpertTemplate } from '@repo/schema';
export type { MCPServer, CreateMCPServer, UpdateMCPServer } from '@repo/schema';
export type { ExpertAdvice, CreateExpertAdvice } from '@repo/schema';
export type { LLMInteraction, CreateLLMInteraction, PromptSegmentData } from '@repo/schema';
