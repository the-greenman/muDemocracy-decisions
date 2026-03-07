/**
 * Service for managing decision logs
 * Handles immutable decision recording with business logic
 */

import type { 
  IDecisionLogRepository, 
  IDecisionContextRepository,
  IDecisionLogService,
  DecisionLog,
  CreateDecisionLog 
} from '@repo/core';
import type { IChunkRelevanceRepository } from '../interfaces/transcript-repositories';
import type { IDecisionTemplateRepository, ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository';
import { logger, withContext } from '../logger';

const FIELD_META_KEY = '__fieldMeta';

export interface LogDecisionOptions {
  /**
   * The ID of the user logging the decision
   */
  loggedBy: string;
  
  /**
   * The method used to make the decision
   */
  decisionMethod: {
    type: 'consensus' | 'vote' | 'authority' | 'defer' | 'reject' | 'manual' | 'ai_assisted';
    details?: string;
  };
  
  /**
   * Optional additional context for the log entry
   */
  context?: {
    correlationId?: string;
    requestId?: string;
    clientInfo?: string;
  };
}

export class DecisionLogService implements IDecisionLogService {
  constructor(
    private decisionLogRepository: IDecisionLogRepository,
    private decisionContextRepository: IDecisionContextRepository,
    private decisionTemplateRepository: IDecisionTemplateRepository,
    private templateFieldAssignmentRepository: ITemplateFieldAssignmentRepository,
    private chunkRelevanceRepository: IChunkRelevanceRepository,
  ) {}

  /**
   * Logs a final decision from a decision context
   * This creates an immutable record of the decision
   */
  async logDecision(
    decisionContextId: string,
    options: LogDecisionOptions
  ): Promise<DecisionLog | null> {
    return withContext(
      { 
        operation: 'logDecision',
        decisionContextId,
        loggedBy: options.loggedBy 
      },
      async () => {
        logger.info('Logging decision', { 
          decisionContextId, 
          loggedBy: options.loggedBy,
          decisionMethod: options.decisionMethod 
        });

        // Verify the decision context exists and is in a loggable state
        const context = await this.decisionContextRepository.findById(decisionContextId);
        if (!context) {
          logger.warn('Decision context not found', { decisionContextId });
          return null;
        }

        if (context.status !== 'locked') {
          logger.warn('Attempted to log decision from unlocked context', { 
            decisionContextId, 
            status: context.status 
          });
          throw new Error('Decision context must be locked before logging');
        }

        const template = await this.decisionTemplateRepository.findById(context.templateId);
        if (!template) {
          throw new Error('Decision template not found');
        }

        const draftFields = Object.fromEntries(
          Object.entries(context.draftData || {}).filter(([fieldId]) => fieldId !== FIELD_META_KEY)
        );
        const templateFields = await this.templateFieldAssignmentRepository.findByTemplateId(context.templateId);
        const missingRequiredFields = templateFields
          .filter((field) => field.required)
          .map((field) => field.fieldId)
          .filter((fieldId) => {
            const value = draftFields[fieldId];
            if (value === null || value === undefined) {
              return true;
            }
            if (typeof value === 'string') {
              return value.trim().length === 0;
            }
            if (Array.isArray(value)) {
              return value.length === 0;
            }
            return false;
          });

        if (missingRequiredFields.length > 0) {
          throw new Error(`Required fields missing: ${missingRequiredFields.join(', ')}`);
        }

        const sourceChunkIds = Array.from(new Set((await Promise.all(
          Object.keys(draftFields).map(async (fieldId) => {
            const relevance = await this.chunkRelevanceRepository.findByDecisionField(decisionContextId, fieldId);
            return relevance.map((entry) => entry.chunkId);
          })
        )).flat()));

        // Create the decision log entry
        const createData: CreateDecisionLog = {
          meetingId: context.meetingId,
          decisionContextId: context.id,
          templateId: context.templateId,
          templateVersion: template.version,
          fields: draftFields,
          decisionMethod: options.decisionMethod,
          sourceChunkIds,
          loggedBy: options.loggedBy,
        };

        const decisionLog = await this.decisionLogRepository.create(createData);
        await this.decisionContextRepository.updateStatus(decisionContextId, 'logged');

        logger.info('Decision logged successfully', { 
          decisionLogId: decisionLog.id,
          decisionContextId 
        });

        return decisionLog;
      }
    );
  }

  /**
   * Retrieves a decision log by ID
   */
  async getDecisionLog(id: string): Promise<DecisionLog | null> {
    logger.debug('Retrieving decision log', { id });
    
    const decisionLog = await this.decisionLogRepository.findById(id);
    
    if (!decisionLog) {
      logger.debug('Decision log not found', { id });
    }
    
    return decisionLog;
  }

  /**
   * Gets all decision logs for a meeting
   */
  async getMeetingDecisionLogs(meetingId: string): Promise<DecisionLog[]> {
    logger.debug('Retrieving decision logs for meeting', { meetingId });
    
    const logs = await this.decisionLogRepository.findByMeetingId(meetingId);
    
    logger.debug('Retrieved meeting decision logs', { 
      meetingId, 
      count: logs.length 
    });
    
    return logs;
  }

  /**
   * Gets all decision logs for a specific decision context
   */
  async getDecisionContextLogs(decisionContextId: string): Promise<DecisionLog[]> {
    logger.debug('Retrieving decision logs for context', { decisionContextId });
    
    const logs = await this.decisionLogRepository.findByDecisionContextId(decisionContextId);
    
    logger.debug('Retrieved context decision logs', { 
      decisionContextId, 
      count: logs.length 
    });
    
    return logs;
  }

  /**
   * Gets all decision logs logged by a specific user
   */
  async getUserDecisionLogs(loggedBy: string): Promise<DecisionLog[]> {
    logger.debug('Retrieving decision logs for user', { loggedBy });
    
    const logs = await this.decisionLogRepository.findByLoggedBy(loggedBy);
    
    logger.debug('Retrieved user decision logs', { 
      loggedBy, 
      count: logs.length 
    });
    
    return logs;
  }

  /**
   * Gets decision logs within a date range
   */
  async getDecisionLogsByDateRange(
    startDate: Date, 
    endDate: Date
  ): Promise<DecisionLog[]> {
    logger.debug('Retrieving decision logs by date range', { 
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    const logs = await this.decisionLogRepository.findByDateRange(startDate, endDate);
    
    logger.debug('Retrieved decision logs by date range', { 
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      count: logs.length
    });
    
    return logs;
  }

  /**
   * Gets statistics about decisions for a meeting
   */
  async getMeetingDecisionStats(meetingId: string): Promise<{
    totalDecisions: number;
    decisionsByMethod: Record<string, number>;
    decisionsByUser: Record<string, number>;
  }> {
    logger.debug('Getting decision statistics for meeting', { meetingId });
    
    const logs = await this.decisionLogRepository.findByMeetingId(meetingId);
    
    const decisionsByMethod: Record<string, number> = {};
    const decisionsByUser: Record<string, number> = {};
    
    logs.forEach(log => {
      // Count by decision method
      decisionsByMethod[log.decisionMethod.type] = 
        (decisionsByMethod[log.decisionMethod.type] || 0) + 1;
      
      // Count by user
      decisionsByUser[log.loggedBy] = 
        (decisionsByUser[log.loggedBy] || 0) + 1;
    });
    
    const stats = {
      totalDecisions: logs.length,
      decisionsByMethod,
      decisionsByUser,
    };
    
    logger.debug('Generated decision statistics', { 
      meetingId, 
      totalDecisions: stats.totalDecisions 
    });
    
    return stats;
  }
}
