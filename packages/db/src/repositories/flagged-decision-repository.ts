/**
 * Drizzle implementation of IFlaggedDecisionRepository
 */

import type { FlaggedDecision, CreateFlaggedDecision } from '@repo/schema';
import type { FlaggedDecisionSelect } from '../schema.js';
import { db } from '../client.js';
import { flaggedDecisions } from '../schema.js';
import { eq, desc } from 'drizzle-orm';

// Interface definition to avoid circular dependency
interface IFlaggedDecisionRepository {
  create(data: CreateFlaggedDecision): Promise<FlaggedDecision>;
  findById(id: string): Promise<FlaggedDecision | null>;
  findByMeetingId(meetingId: string): Promise<FlaggedDecision[]>;
  update(id: string, data: Partial<Omit<CreateFlaggedDecision, 'meetingId'>>): Promise<FlaggedDecision | null>;
  updateStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null>;
  delete(id: string): Promise<boolean>;
}

export class DrizzleFlaggedDecisionRepository implements IFlaggedDecisionRepository {
  async create(data: CreateFlaggedDecision): Promise<FlaggedDecision> {
    const [row] = await db
      .insert(flaggedDecisions)
      .values({
        ...data,
        suggestedTemplateId: data.suggestedTemplateId || null,
        templateConfidence: data.templateConfidence || null,
        status: 'pending',
        priority: data.priority || 0,
      })
      .returning();

    if (!row) {
      throw new Error('Failed to create flagged decision');
    }

    return this.mapToSchema(row);
  }

  async findByMeetingId(meetingId: string): Promise<FlaggedDecision[]> {
    const rows = await db
      .select()
      .from(flaggedDecisions)
      .where(eq(flaggedDecisions.meetingId, meetingId))
      .orderBy(desc(flaggedDecisions.priority), flaggedDecisions.createdAt);

    return rows.map(row => this.mapToSchema(row));
  }

  async findById(id: string): Promise<FlaggedDecision | null> {
    const [row] = await db
      .select()
      .from(flaggedDecisions)
      .where(eq(flaggedDecisions.id, id));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async update(
    id: string,
    data: Partial<Omit<CreateFlaggedDecision, 'meetingId'>>
  ): Promise<FlaggedDecision | null> {
    const updateData: any = {
      ...data,
    };
    
    if (data.suggestedTemplateId !== undefined) {
      updateData.suggestedTemplateId = data.suggestedTemplateId || null;
    }
    
    if (data.templateConfidence !== undefined) {
      updateData.templateConfidence = data.templateConfidence || null;
    }

    const [row] = await db
      .update(flaggedDecisions)
      .set(updateData)
      .where(eq(flaggedDecisions.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async updatePriority(id: string, priority: number): Promise<FlaggedDecision | null> {
    const [row] = await db
      .update(flaggedDecisions)
      .set({
        priority,
      })
      .where(eq(flaggedDecisions.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async updateStatus(id: string, status: FlaggedDecision['status']): Promise<FlaggedDecision | null> {
    const [row] = await db
      .update(flaggedDecisions)
      .set({
        status,
      })
      .where(eq(flaggedDecisions.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async delete(id: string): Promise<boolean> {
    const [row] = await db
      .delete(flaggedDecisions)
      .where(eq(flaggedDecisions.id, id))
      .returning();

    return !!row;
  }

  private mapToSchema(row: FlaggedDecisionSelect): FlaggedDecision {
    return {
      id: row.id,
      meetingId: row.meetingId,
      suggestedTitle: row.suggestedTitle,
      contextSummary: row.contextSummary,
      confidence: row.confidence,
      chunkIds: row.chunkIds,
      suggestedTemplateId: row.suggestedTemplateId || undefined,
      templateConfidence: row.templateConfidence || undefined,
      status: row.status,
      priority: row.priority,
      createdAt: row.createdAt!.toISOString(),
      updatedAt: (row as any).updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
