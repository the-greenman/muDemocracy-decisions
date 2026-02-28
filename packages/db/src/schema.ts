/**
 * Decision Logger Database Schema - Phase 0
 * 
 * This is the canonical source of truth for the database schema.
 * - Type-safe with TypeScript
 * - Generated from Zod schemas (SSOT)
 * - Generates migrations automatically
 * - Testable and validatable
 * - Version controlled
 */

import { pgTable, uuid, text, date, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// MEETINGS
// ============================================================================

// Enums
export const meetingStatusEnum = pgEnum('meeting_status', ['active', 'completed']);

export const meetings = pgTable('meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  date: date('date').notNull(),
  participants: text('participants').array().notNull(),
  status: meetingStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_meetings_status').on(table.status),
  dateIdx: index('idx_meetings_date').on(table.date),
}));

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type MeetingSelect = typeof meetings.$inferSelect;
export type MeetingInsert = typeof meetings.$inferInsert;


// ============================================================================
// RELATIONS
// ============================================================================

export const meetingsRelations = relations(meetings, () => ({
  // Will add relations in later phases
}));

// ============================================================================
// EXPORTS
// ============================================================================

export const schema = {
  meetings,
};
