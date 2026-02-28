import { 
  pgTable, 
  uuid, 
  text, 
  date, 
  timestamp,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const meetingStatusEnum = pgEnum('meeting_status', ['active', 'completed']);

// Meetings table - Phase 0 vertical slice
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

// Type inference
export type MeetingSelect = typeof meetings.$inferSelect;
export type MeetingInsert = typeof meetings.$inferInsert;

// Relations (for future use)
export const meetingsRelations = relations(meetings, ({ many }: { many: any }) => ({
  // Will add relations in later phases
}));

// Export schema
export const schema = {
  meetings,
};
