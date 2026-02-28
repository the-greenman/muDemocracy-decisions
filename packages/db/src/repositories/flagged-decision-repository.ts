/**
 * Drizzle implementation of IFlaggedDecisionRepository
 */

import type { IFlaggedDecisionRepository } from '@repo/core';
import { FlaggedDecision } from '@repo/schema';
import type { CreateFlaggedDecision } from '@repo/schema';
import { db } from '../client';
import { flaggedDecisions } from '../schema';
import { eq, desc } from 'drizzle-orm';

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
    data: Partial<Omit<CreateFlaggedDecision, 'meetingId' | 'chunkIds'>>
  ): Promise<FlaggedDecision | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
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
        updatedAt: new Date(),
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
        updatedAt: new Date(),
      })
      .where(eq(flaggedDecisions.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  private mapToSchema(row: any): FlaggedDecision {
    return {
      id: row.id,
      meetingId: row.meetingId,
      suggestedTitle: row.suggestedTitle,
      contextSummary: row.contextSummary,
      confidence: row.confidence,
      chunkIds: row.chunkIds,
      suggestedTemplateId: row.suggestedTemplateId,
      templateConfidence: row.templateConfidence,
      status: row.status,
      priority: row.priority,
      createdAt: row.createdAt!.toISOString(),
      updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }
}
