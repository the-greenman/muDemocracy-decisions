// LLM
export type {
  ILLMService,
  GenerateDraftParams,
  RegenerateFieldParams,
  DraftResult,
} from "./llm/index.js";
export type { PromptSegment } from "./llm/index.js";
export { PromptBuilder, MockLLMService, VercelAILLMService } from "./llm/index.js";

// Services
export { MeetingService } from "./services/meeting-service.js";
export { TranscriptService } from "./services/transcript-service.js";
export { FlaggedDecisionService } from "./services/flagged-decision-service.js";
export { DecisionContextService } from "./services/decision-context-service.js";
export {
  GlobalContextService,
  InMemoryGlobalContextStore,
  FileGlobalContextStore,
} from "./services/global-context-service.js";
export { DecisionLogService } from "./services/decision-log-service.js";
export { DecisionFieldService } from "./services/decision-field-service.js";
export { DecisionTemplateService } from "./services/decision-template-service.js";
export { ExportTemplateService } from "./services/export-template-service.js";
export { ExpertTemplateService } from "./services/expert-template-service.js";
export { MCPServerService } from "./services/mcp-server-service.js";
export { ExpertAdviceService } from "./services/expert-advice-service.js";
export { DraftGenerationService } from "./services/draft-generation-service.js";
export { SupplementaryContentService } from "./services/supplementary-content-service.js";
export { FeedbackService } from "./services/feedback-service.js";
export { InProcessEventBus } from "./events/in-process-event-bus.js";

// Service Factory
export {
  createMeetingService,
  createDecisionLogService,
  createDecisionLogGenerator,
  createDecisionContextService,
  createTranscriptService,
  createTranscriptManager,
  createDecisionFieldService,
  createDraftGenerationService,
  createSupplementaryContentService,
  createFeedbackService,
  createContentCreator,
  createFlaggedDecisionService,
  createDecisionTemplateService,
  createExportTemplateService,
  createGlobalContextService,
  createLLMInteractionService,
  createMarkdownExportService,
  createEventBus,
  createDecisionContextRepository,
  createDecisionTemplateRepository,
  createDecisionFieldRepository,
  createTemplateFieldAssignmentRepository,
  createServices,
  createExpertTemplateService,
  createMCPServerService,
  createConnectionRepository,
  type ServiceContainer,
} from "./service-factory.js";

// Logger
export {
  Logger,
  logger,
  withContext,
  getContext,
  getCorrelationId,
  addContext,
  correlationMiddleware,
} from "./logger/index.js";
export type { LogContext, LoggerConfig, LogLevel, RedactionOptions } from "./logger/index.js";

// Interfaces
export type { IMeetingRepository } from "./interfaces/i-meeting-repository.js";
export type { ILLMInteractionRepository } from "./interfaces/i-llm-interaction-repository.js";
export type { IFlaggedDecisionRepository } from "./interfaces/i-flagged-decision-repository.js";
export type { IFlaggedDecisionService } from "./interfaces/i-flagged-decision-service.js";
export type { IDecisionContextRepository } from "./interfaces/i-decision-context-repository.js";
export type { IDecisionContextService } from "./interfaces/i-decision-context-service.js";
export type { ITranscriptManager } from "./transcript-manager/index.js";
export type { IDecisionLogGenerator } from "./decision-log-generator/i-decision-log-generator.js";
export type { IContentCreator } from "./decision-log-generator/i-content-creator.js";
export type { IEventBus, EventHandler } from "./events/i-event-bus.js";
export type {
  DecisionEvent,
  DecisionContextCreatedEvent,
  DraftGeneratedEvent,
  DecisionLoggedEvent,
} from "./events/decision-events.js";
export type {
  IGlobalContextService,
  IGlobalContextStore,
  GlobalContext,
  GlobalContextState,
} from "./interfaces/i-global-context-service.js";
export type { IDecisionLogRepository } from "./interfaces/i-decision-log-repository.js";
export type { IDecisionLogService } from "./interfaces/i-decision-log-service.js";
export type {
  IDecisionFieldRepository,
  DecisionFieldIdentityLookup,
} from "./interfaces/i-decision-field-repository.js";
export type { IDecisionFieldService } from "./interfaces/i-decision-field-service.js";
export type {
  IDecisionTemplateRepository,
  ITemplateFieldAssignmentRepository,
  DecisionTemplateIdentityLookup,
} from "./interfaces/i-decision-template-repository.js";
export type { IDecisionTemplateService } from "./interfaces/i-decision-template-service.js";
export type {
  IExportTemplateRepository,
  IExportTemplateFieldAssignmentRepository,
  ExportTemplateFieldAssignmentInsert,
} from "./interfaces/i-export-template-repository.js";
export type { IExportTemplateService } from "./interfaces/i-export-template-service.js";
export type { ISupplementaryContentRepository } from "./interfaces/i-supplementary-content-repository.js";
export type { IFeedbackRepository } from "./interfaces/i-feedback-repository.js";
export type { IExpertTemplateRepository } from "./interfaces/i-expert-template-repository.js";
export type { IExpertTemplateService } from "./services/expert-template-service.js";
export type { IMCPServerService } from "./services/mcp-server-service.js";
export type { IExpertAdviceService } from "./services/expert-advice-service.js";
export type {
  IRawTranscriptRepository,
  ITranscriptChunkRepository,
  IStreamingBufferRepository,
  IChunkRelevanceRepository,
  IDecisionContextWindowRepository,
} from "./interfaces/transcript-repositories.js";

// Re-export types from schema for convenience
export type { Meeting, CreateMeeting, UpdateMeeting } from "@repo/schema";
export type { DecisionLog, CreateDecisionLog } from "@repo/schema";
export type { DecisionContext, CreateDecisionContext } from "@repo/schema";
export type { FlaggedDecision } from "@repo/schema";
export type { DecisionField, CreateDecisionField } from "@repo/schema";
export type { DecisionTemplate, CreateDecisionTemplate } from "@repo/schema";
export type { TemplateFieldAssignment, CreateTemplateFieldAssignment } from "@repo/schema";
export type {
  ExportTemplate,
  CreateExportTemplate,
  ExportTemplateFieldAssignment,
  CreateExportTemplateFieldAssignment,
} from "@repo/schema";
export type { ExpertTemplate, CreateExpertTemplate, UpdateExpertTemplate } from "@repo/schema";
export type { MCPServer, CreateMCPServer, UpdateMCPServer } from "@repo/schema";
export type { ExpertAdvice, CreateExpertAdvice } from "@repo/schema";
export type {
  DecisionFeedback,
  CreateDecisionFeedback,
  UpdateDecisionFeedback,
  FeedbackRating,
  FeedbackSource,
} from "@repo/schema";
export type { LLMInteraction, CreateLLMInteraction, PromptSegmentData } from "@repo/schema";
export type { SupplementaryContent, CreateSupplementaryContent } from "@repo/schema";
export type { ReadableTranscriptRow } from "@repo/schema";
