/**
 * DrizzleMeetingRepository
 * 
 * PostgreSQL-backed implementation of IMeetingRepository using Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { meetings, MeetingSelect, MeetingInsert } from '../schema.js';
import { Meeting, CreateMeeting } from '@repo/schema';

function toMeetingIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.toISOString().split('T')[0]}T00:00:00Z`;
  }

  const datePart = value.split('T')[0];
  if (!datePart) {
    throw new Error('Invalid stored meeting date');
  }

  return `${datePart}T00:00:00Z`;
}

export class DrizzleMeetingRepository {
  async create(data: CreateMeeting): Promise<Meeting> {
    // Extract date portion from ISO datetime string
    const datePart = data.date.split('T')[0];
    if (!datePart) {
      throw new Error('Invalid date format');
    }

    const insertData: MeetingInsert = {
      title: data.title,
      date: datePart,
      participants: data.participants,
      status: 'active',
    };

    const result = await db.insert(meetings).values(insertData).returning();
    if (!result[0]) {
      throw new Error('Failed to create meeting');
    }
    return this.mapToMeeting(result[0]);
  }

  async findById(id: string): Promise<Meeting | null> {
    const [result] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);

    return result ? this.mapToMeeting(result) : null;
  }

  async findAll(): Promise<Meeting[]> {
    const result = await db.select().from(meetings).orderBy(meetings.date);
    return result.map(this.mapToMeeting);
  }

  async update(id: string, data: Partial<Pick<CreateMeeting, 'title' | 'participants'>>): Promise<Meeting> {
    const updateData: Partial<MeetingInsert> = {};
    
    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    
    if (data.participants !== undefined) {
      updateData.participants = data.participants;
    }

    const result = await db
      .update(meetings)
      .set(updateData)
      .where(eq(meetings.id, id))
      .returning();

    if (!result[0]) {
      throw new Error('Meeting not found');
    }

    return this.mapToMeeting(result[0]);
  }

  async updateStatus(
    id: string,
    status: 'active' | 'completed'
  ): Promise<Meeting> {
    const [result] = await db
      .update(meetings)
      .set({ status })
      .where(eq(meetings.id, id))
      .returning();

    if (!result) {
      throw new Error(`Meeting with id ${id} not found`);
    }

    return this.mapToMeeting(result);
  }

  async delete(id: string): Promise<boolean> {
    const [result] = await db
      .delete(meetings)
      .where(eq(meetings.id, id))
      .returning();

    return !!result;
  }

  private mapToMeeting(dbMeeting: MeetingSelect): Meeting {
    return {
      id: dbMeeting.id,
      title: dbMeeting.title,
      date: toMeetingIsoDate(dbMeeting.date),
      participants: dbMeeting.participants,
      status: dbMeeting.status,
      createdAt: dbMeeting.createdAt.toISOString(),
    };
  }
}
