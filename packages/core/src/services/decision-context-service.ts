/**
 * Decision Context Service implementation
 * Manages draft state, field locking, and field-specific transcript retrieval
 */

import type {
  DecisionContext,
  DraftVersion,
  CreateDecisionContext,
  UpdateDecisionContext,
} from '@repo/schema';
import type { IDecisionContextService } from '../interfaces/i-decision-context-service.js';
import type { IDecisionContextRepository } from '../interfaces/i-decision-context-repository.js';
import type { ITemplateFieldAssignmentRepository } from '../interfaces/i-decision-template-repository.js';
import { logger } from '../logger/index.js';

const FIELD_META_KEY = '__fieldMeta';

type FieldMetaRecord = Record<string, { manuallyEdited?: boolean }>;

export class DecisionContextService implements IDecisionContextService {
  constructor(
    private repository: IDecisionContextRepository,
    private templateFieldAssignmentRepository?: ITemplateFieldAssignmentRepository,
  ) {}

  async createContext(data: CreateDecisionContext): Promise<DecisionContext> {
    logger.info('Creating decision context', { 
      meetingId: data.meetingId,
      flaggedDecisionId: data.flaggedDecisionId,
      title: data.title,
      templateId: data.templateId
    });
    
    return await this.repository.create(data);
  }

  async changeTemplate(id: string, templateId: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    return await this.repository.update(id, { templateId });
  }

  async updateDraftData(id: string, data: Record<string, any>): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    // Don't update locked fields
    const currentDraft = context.draftData || {};
    const updatedDraft = { ...currentDraft };
    
    for (const [key, value] of Object.entries(data)) {
      if (!context.lockedFields.includes(key)) {
        updatedDraft[key] = value;
      }
    }

    return await this.repository.update(id, { draftData: updatedDraft });
  }

  async setFieldValue(id: string, fieldId: string, value: unknown): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    await this.assertFieldAssignedToTemplate(context.templateId, fieldId);

    const currentDraft = context.draftData ?? {};
    const fieldMeta = this.getFieldMeta(currentDraft);
    return await this.repository.update(id, {
      draftData: {
        ...currentDraft,
        [fieldId]: value,
        [FIELD_META_KEY]: {
          ...fieldMeta,
          [fieldId]: {
            ...fieldMeta[fieldId],
            manuallyEdited: true,
          },
        },
      },
    });
  }

  async saveSnapshot(id: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    const draftVersions = context.draftVersions ?? [];

    const snapshot: DraftVersion = {
      version: draftVersions.length + 1,
      draftData: { ...(context.draftData ?? {}) },
      savedAt: new Date().toISOString(),
    };

    return await this.repository.update(id, {
      draftVersions: [...draftVersions, snapshot],
    });
  }

  async rollback(id: string, version: number): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    const snapshot = (context.draftVersions ?? []).find((entry) => entry.version === version);
    if (!snapshot) {
      throw new Error(`Draft version ${version} not found`);
    }

    return await this.repository.update(id, {
      draftData: { ...snapshot.draftData },
    });
  }

  async listVersions(id: string): Promise<Array<{ version: number; savedAt: string; fieldCount: number }>> {
    const context = await this.repository.findById(id);
    if (!context) {
      return [];
    }

    return (context.draftVersions ?? []).map((entry) => ({
      version: entry.version,
      savedAt: entry.savedAt,
      fieldCount: this.getDraftFieldKeys(entry.draftData).length,
    }));
  }

  async lockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      logger.warn('Attempted to lock field on non-existent context', { id, fieldId });
      return null;
    }

    if (context.lockedFields.includes(fieldId)) {
      logger.debug('Field already locked', { id, fieldId });
      return context;
    }

    logger.info('Locking field', { 
      id, 
      fieldId, 
      currentLockedCount: context.lockedFields.length,
      status: context.status 
    });

    const result = await this.repository.lockField(id, fieldId);
    
    if (result) {
      logger.info('Field locked successfully', { 
        id, 
        fieldId, 
        newLockedCount: result.lockedFields.length 
      });
    }
    
    return result;
  }

  async unlockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    // If context is locked and we're unlocking the last field, revert to reviewing
    if (context.status === 'locked' && context.lockedFields.length === 1 && context.lockedFields.includes(fieldId)) {
      const unlocked = await this.repository.unlockField(id, fieldId);
      if (unlocked) {
        return await this.repository.updateStatus(id, 'reviewing');
      }
      return null;
    }

    // Otherwise just unlock the field
    return await this.repository.unlockField(id, fieldId);
  }

  async setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null> {
    const result = await this.repository.setActiveField(id, fieldId);
    return result;
  }

  async submitForReview(id: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      logger.warn('Attempted to submit non-existent context for review', { id });
      return null;
    }

    // Can only submit from drafting status
    if (context.status !== 'drafting') {
      logger.warn('Invalid status transition attempted', { 
        id, 
        currentStatus: context.status, 
        targetStatus: 'reviewing' 
      });
      throw new Error('Can only submit contexts that are in drafting status');
    }

    logger.info('Submitting context for review', { 
      id, 
      title: context.title,
      fieldCount: Object.keys(context.draftData || {}).length 
    });

    return await this.repository.updateStatus(id, 'reviewing');
  }

  async approveAndLock(id: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      logger.warn('Attempted to approve non-existent context', { id });
      return null;
    }

    // Can only approve from reviewing status
    if (context.status !== 'reviewing') {
      logger.warn('Invalid status transition attempted', { 
        id, 
        currentStatus: context.status, 
        targetStatus: 'locked' 
      });
      throw new Error('Can only approve contexts that are in reviewing status');
    }

    logger.info('Approving and locking context', { 
      id, 
      title: context.title,
      totalFields: this.getDraftFieldKeys(context.draftData).length,
      currentlyLocked: context.lockedFields.length 
    });

    // Lock all fields atomically
    await this.repository.lockAllFields(id);

    // Update status to locked
    const result = await this.repository.updateStatus(id, 'locked');
    
    if (result) {
      logger.info('Context approved and locked successfully', { 
        id, 
        finalLockedCount: result.lockedFields.length 
      });
    }
    
    return result;
  }

  async reopenForEditing(id: string): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) {
      return null;
    }

    // Can only reopen from reviewing status
    if (context.status !== 'reviewing') {
      throw new Error('Can only reopen contexts that are in reviewing status');
    }

    return await this.repository.updateStatus(id, 'drafting');
  }

  async getById(id: string): Promise<DecisionContext | null> {
    return await this.repository.findById(id);
  }

  async getContextByFlaggedDecision(flaggedDecisionId: string): Promise<DecisionContext | null> {
    return await this.repository.findByFlaggedDecisionId(flaggedDecisionId);
  }

  async getAllContextsForMeeting(meetingId: string): Promise<DecisionContext[]> {
    return await this.repository.findByMeetingId(meetingId);
  }

  async updateMeta(id: string, data: UpdateDecisionContext): Promise<DecisionContext | null> {
    const context = await this.repository.findById(id);
    if (!context) return null;
    const patch: Partial<DecisionContext> = {};
    if (data.title !== undefined) patch.title = data.title;
    return await this.repository.update(id, patch);
  }

  private async assertFieldAssignedToTemplate(templateId: string, fieldId: string): Promise<void> {
    if (!this.templateFieldAssignmentRepository) {
      return;
    }

    const assignments = await this.templateFieldAssignmentRepository.findByTemplateId(templateId);
    const isAssigned = assignments.some((assignment) => assignment.fieldId === fieldId);
    if (!isAssigned) {
      throw new Error(`Field ${fieldId} is not assigned to template ${templateId}`);
    }
  }

  private getDraftFieldKeys(draftData?: Record<string, unknown>): string[] {
    return Object.keys(draftData ?? {}).filter((key) => key !== FIELD_META_KEY);
  }

  private getFieldMeta(draftData: Record<string, unknown>): FieldMetaRecord {
    const meta = draftData[FIELD_META_KEY];
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return {};
    }

    return meta as FieldMetaRecord;
  }
}
