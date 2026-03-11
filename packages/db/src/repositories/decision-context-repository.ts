/**
 * Drizzle implementation of IDecisionContextRepository
 */

import { decisionContexts } from "../schema.js";
import { db } from "../client.js";
import { eq, sql } from "drizzle-orm";
import { DecisionContext, CreateDecisionContext } from "@repo/schema";

const FIELD_META_KEY = "__fieldMeta";

interface IDecisionContextRepository {
  create(data: CreateDecisionContext): Promise<DecisionContext>;
  findById(id: string): Promise<DecisionContext | null>;
  findByMeetingId(meetingId: string): Promise<DecisionContext[]>;
  findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null>;
  update(id: string, data: Partial<DecisionContext>): Promise<DecisionContext | null>;
  lockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  unlockField(id: string, fieldId: string): Promise<DecisionContext | null>;
  lockAllFields(id: string): Promise<DecisionContext | null>;
  setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null>;
  updateStatus(id: string, status: DecisionContext["status"]): Promise<DecisionContext | null>;
}

export class DrizzleDecisionContextRepository implements IDecisionContextRepository {
  async create(data: CreateDecisionContext): Promise<DecisionContext> {
    const [row] = await db
      .insert(decisionContexts)
      .values({
        meetingId: data.meetingId,
        flaggedDecisionId: data.flaggedDecisionId,
        title: data.title,
        templateId: data.templateId,
        activeField: data.activeField || null,
        draftData: data.draftData || null,
        draftVersions: [],
        status: "drafting",
        lockedFields: [],
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create decision context");
    }

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<DecisionContext | null> {
    const [row] = await db.select().from(decisionContexts).where(eq(decisionContexts.id, id));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async findByMeetingId(meetingId: string): Promise<DecisionContext[]> {
    const rows = await db
      .select()
      .from(decisionContexts)
      .where(eq(decisionContexts.meetingId, meetingId))
      .orderBy(decisionContexts.createdAt);

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByFlaggedDecisionId(flaggedDecisionId: string): Promise<DecisionContext | null> {
    const [row] = await db
      .select()
      .from(decisionContexts)
      .where(eq(decisionContexts.flaggedDecisionId, flaggedDecisionId));

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async update(id: string, data: Partial<DecisionContext>): Promise<DecisionContext | null> {
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    const [row] = await db
      .update(decisionContexts)
      .set(updateData)
      .where(eq(decisionContexts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async lockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    // First get current context to check if field is already locked
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const lockedFields = current.lockedFields.includes(fieldId)
      ? current.lockedFields
      : [...current.lockedFields, fieldId];

    const [row] = await db
      .update(decisionContexts)
      .set({
        lockedFields,
        updatedAt: new Date(),
      })
      .where(eq(decisionContexts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async unlockField(id: string, fieldId: string): Promise<DecisionContext | null> {
    // First get current context
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const lockedFields = current.lockedFields.filter((id) => id !== fieldId);

    const [row] = await db
      .update(decisionContexts)
      .set({
        lockedFields,
        updatedAt: new Date(),
      })
      .where(eq(decisionContexts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async lockAllFields(id: string): Promise<DecisionContext | null> {
    // Get current context to determine all fields
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    // Get all field IDs from draft data
    const allFields = Object.keys(current.draftData || {}).filter(
      (fieldId) => fieldId !== FIELD_META_KEY,
    );

    // Combine with currently locked fields to ensure we don't lose any
    const lockedFields = [...new Set([...current.lockedFields, ...allFields])];

    const [row] = await db
      .update(decisionContexts)
      .set({
        lockedFields,
        updatedAt: new Date(),
      })
      .where(eq(decisionContexts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async setActiveField(id: string, fieldId: string | null): Promise<DecisionContext | null> {
    if (fieldId === null) {
      // Use raw SQL to ensure null is set correctly
      const rows = await db.execute(sql`
        UPDATE decision_contexts 
        SET active_field = NULL, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `);

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.mapToSchema(rows[0]);
    } else {
      const [row] = await db
        .update(decisionContexts)
        .set({
          activeField: fieldId,
          updatedAt: new Date(),
        })
        .where(eq(decisionContexts.id, id))
        .returning();

      if (!row) {
        return null;
      }

      return this.mapToSchema(row);
    }
  }

  async updateStatus(
    id: string,
    status: DecisionContext["status"],
  ): Promise<DecisionContext | null> {
    const [row] = await db
      .update(decisionContexts)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(decisionContexts.id, id))
      .returning();

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  private mapToSchema(row: any): DecisionContext {
    return {
      id: row.id,
      meetingId: row.meeting_id || row.meetingId, // Handle both snake_case from raw SQL and camelCase from Drizzle
      flaggedDecisionId: row.flagged_decision_id || row.flaggedDecisionId,
      title: row.title,
      templateId: row.template_id || row.templateId,
      activeField: row.active_field ?? row.activeField ?? null,
      lockedFields: row.locked_fields || row.lockedFields,
      draftData: row.draft_data || row.draftData || undefined,
      draftVersions: row.draft_versions || row.draftVersions || [],
      status: row.status,
      createdAt: (row.created_at || row.createdAt).toISOString(),
      updatedAt: (row.updated_at || row.updatedAt).toISOString(),
    };
  }
}
