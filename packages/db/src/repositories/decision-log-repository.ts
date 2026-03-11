/**
 * Drizzle implementation of IDecisionLogRepository
 */

import { decisionLogs } from "../schema.js";
import { db } from "../client.js";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { DecisionLog } from "@repo/schema";

// Type definitions to avoid circular dependency
type CreateDecisionLog = Omit<DecisionLog, "id" | "loggedAt">;

// Interface definition to avoid circular dependency
interface IDecisionLogRepository {
  create(data: CreateDecisionLog): Promise<DecisionLog>;
  findById(id: string): Promise<DecisionLog | null>;
  findByMeetingId(meetingId: string): Promise<DecisionLog[]>;
  findByDecisionContextId(decisionContextId: string): Promise<DecisionLog[]>;
  findByLoggedBy(loggedBy: string): Promise<DecisionLog[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]>;
  countByMeetingId(meetingId: string): Promise<number>;
}

export class DrizzleDecisionLogRepository implements IDecisionLogRepository {
  async create(data: CreateDecisionLog): Promise<DecisionLog> {
    const [row] = await db
      .insert(decisionLogs)
      .values({
        meetingId: data.meetingId,
        decisionContextId: data.decisionContextId,
        templateId: data.templateId,
        templateVersion: data.templateVersion,
        fields: data.fields,
        decisionMethod: data.decisionMethod,
        sourceChunkIds: data.sourceChunkIds,
        loggedBy: data.loggedBy,
      })
      .returning();

    return this.mapToSchema(row);
  }

  async findById(id: string): Promise<DecisionLog | null> {
    const [row] = await db.select().from(decisionLogs).where(eq(decisionLogs.id, id)).limit(1);

    if (!row) {
      return null;
    }

    return this.mapToSchema(row);
  }

  async findByMeetingId(meetingId: string): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(decisionLogs)
      .where(eq(decisionLogs.meetingId, meetingId))
      .orderBy(desc(decisionLogs.loggedAt));

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByDecisionContextId(decisionContextId: string): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(decisionLogs)
      .where(eq(decisionLogs.decisionContextId, decisionContextId))
      .orderBy(desc(decisionLogs.loggedAt));

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByLoggedBy(loggedBy: string): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(decisionLogs)
      .where(eq(decisionLogs.loggedBy, loggedBy))
      .orderBy(desc(decisionLogs.loggedAt));

    return rows.map((row) => this.mapToSchema(row));
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<DecisionLog[]> {
    const rows = await db
      .select()
      .from(decisionLogs)
      .where(and(gte(decisionLogs.loggedAt, startDate), lte(decisionLogs.loggedAt, endDate)))
      .orderBy(desc(decisionLogs.loggedAt));

    return rows.map((row) => this.mapToSchema(row));
  }

  async countByMeetingId(meetingId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(decisionLogs)
      .where(eq(decisionLogs.meetingId, meetingId));

    return result?.count || 0;
  }

  private mapToSchema(row: any): DecisionLog {
    return {
      id: row.id,
      meetingId: row.meetingId, // Drizzle returns camelCase
      decisionContextId: row.decisionContextId,
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      fields: row.fields,
      decisionMethod: row.decisionMethod,
      sourceChunkIds: row.sourceChunkIds || undefined,
      loggedAt: row.loggedAt instanceof Date ? row.loggedAt.toISOString() : row.loggedAt,
      loggedBy: row.loggedBy,
    };
  }
}
