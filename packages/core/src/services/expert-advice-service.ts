/**
 * Expert Advice Service
 * Manages expert advice history and provides expert consultation
 */

import type { 
  ExpertAdvice,
  CreateExpertAdvice,
} from '@repo/schema';
import type { IExpertAdviceHistoryRepository } from '../interfaces/i-expert-advice-history-repository';
import type { IExpertTemplateRepository } from '../interfaces/i-expert-template-repository';
import { logger } from '../logger';

export interface IExpertAdviceService {
  // Advice history management
  createAdvice(data: CreateExpertAdvice): Promise<ExpertAdvice>;
  getAdviceById(id: string): Promise<ExpertAdvice | null>;
  getAdviceByDecisionContext(decisionContextId: string): Promise<ExpertAdvice[]>;
  getAdviceByExpert(expertId: string): Promise<ExpertAdvice[]>;
  getRecentAdvice(limit?: number): Promise<ExpertAdvice[]>;
  getAdviceByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]>;
  
  // Analytics
  getAdviceCountByExpert(expertId: string): Promise<number>;
  getAdviceCountByDecision(decisionContextId: string): Promise<number>;
  
  // Expert consultation
  consultExpert(
    expertId: string, 
    decisionContextId: string, 
    request: string,
    context?: Record<string, any>
  ): Promise<ExpertAdvice>;
}

export class ExpertAdviceService implements IExpertAdviceService {
  constructor(
    private adviceRepository: IExpertAdviceHistoryRepository,
    private expertTemplateRepository: IExpertTemplateRepository
  ) {}

  async createAdvice(data: CreateExpertAdvice): Promise<ExpertAdvice> {
    logger.info('Creating expert advice', { 
      expertId: data.expertId, 
      decisionContextId: data.decisionContextId 
    });
    
    // Validate the advice
    const validation = await this.validateAdvice(data);
    if (!validation.isValid) {
      throw new Error(`Invalid advice: ${validation.errors.join(', ')}`);
    }
    
    const advice = await this.adviceRepository.create(data);
    logger.info('Expert advice created successfully', { id: advice.id });
    
    return advice;
  }

  async getAdviceById(id: string): Promise<ExpertAdvice | null> {
    logger.debug('Getting expert advice by ID', { id });
    return await this.adviceRepository.findById(id);
  }

  async getAdviceByDecisionContext(decisionContextId: string): Promise<ExpertAdvice[]> {
    logger.debug('Getting expert advice by decision context', { decisionContextId });
    return await this.adviceRepository.findByDecisionContextId(decisionContextId);
  }

  async getAdviceByExpert(expertId: string): Promise<ExpertAdvice[]> {
    logger.debug('Getting expert advice by expert', { expertId });
    return await this.adviceRepository.findByExpertId(expertId);
  }

  async getRecentAdvice(limit: number = 10): Promise<ExpertAdvice[]> {
    logger.debug('Getting recent expert advice', { limit });
    return await this.adviceRepository.findRecent(limit);
  }

  async getAdviceByDateRange(startDate: Date, endDate: Date): Promise<ExpertAdvice[]> {
    logger.debug('Getting expert advice by date range', { startDate, endDate });
    return await this.adviceRepository.findByDateRange(startDate, endDate);
  }

  async getAdviceCountByExpert(expertId: string): Promise<number> {
    logger.debug('Getting advice count by expert', { expertId });
    return await this.adviceRepository.getAdviceCountByExpert(expertId);
  }

  async getAdviceCountByDecision(decisionContextId: string): Promise<number> {
    logger.debug('Getting advice count by decision', { decisionContextId });
    return await this.adviceRepository.getAdviceCountByDecision(decisionContextId);
  }

  async consultExpert(
    expertId: string, 
    decisionContextId: string, 
    request: string
  ): Promise<ExpertAdvice> {
    logger.info('Starting expert consultation', { 
      expertId, 
      decisionContextId, 
      request 
    });
    
    // Get the expert template
    const expert = await this.expertTemplateRepository.findById(expertId);
    if (!expert) {
      throw new Error(`Expert template not found: ${expertId}`);
    }
    
    if (!expert.isActive) {
      throw new Error(`Expert is not active: ${expert.name}`);
    }
    
    // In a real implementation, this would:
    // 1. Format the request using the expert's prompt template
    // 2. Connect to MCP servers if needed
    // 3. Get advice from the expert (LLM or human)
    // 4. Store the advice
    
    // For now, create a mock response
    const mockResponse = {
      suggestions: [
        `Based on the request: "${request}", I recommend considering the following options...`,
        'Please review the implications of each option carefully.'
      ],
      concerns: [
        'Ensure all stakeholders are consulted before making a final decision.'
      ],
      questions: [
        'What is the timeline for this decision?',
        'What resources are available?'
      ]
    };
    
    const adviceData: CreateExpertAdvice = {
      decisionContextId,
      expertId,
      expertName: expert.name,
      request,
      response: mockResponse,
      mcpToolsUsed: [] // Would be populated if MCP servers were used
    };
    
    const advice = await this.createAdvice(adviceData);
    logger.info('Expert consultation completed', { id: advice.id });
    
    return advice;
  }

  private async validateAdvice(advice: CreateExpertAdvice): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    // Decision context ID validation
    if (!advice.decisionContextId) {
      errors.push('Decision context ID is required');
    }
    
    // Expert ID validation
    if (!advice.expertId) {
      errors.push('Expert ID is required');
    } else {
      // Check if expert exists
      const expert = await this.expertTemplateRepository.findById(advice.expertId);
      if (!expert) {
        errors.push(`Expert not found: ${advice.expertId}`);
      } else if (!expert.isActive) {
        errors.push(`Expert is not active: ${expert.name}`);
      }
    }
    
    // Expert name validation
    if (!advice.expertName || advice.expertName.trim().length === 0) {
      errors.push('Expert name is required');
    }
    
    // Request validation
    if (!advice.request || advice.request.trim().length === 0) {
      errors.push('Request is required');
    }
    
    // Response validation
    if (!advice.response) {
      errors.push('Response is required');
    } else if (typeof advice.response !== 'object') {
      errors.push('Response must be an object');
    } else {
      if (!advice.response.suggestions || !Array.isArray(advice.response.suggestions)) {
        errors.push('Response must include suggestions array');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
