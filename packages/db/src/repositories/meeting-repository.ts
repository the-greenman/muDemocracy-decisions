/**
 * DrizzleMeetingRepository
 * 
 * PostgreSQL-backed implementation of IMeetingRepository using Drizzle ORM.
 */

import { eq } from 'drizzle-orm';
import { db } from '../client';
import { meetings, MeetingSelect, MeetingInsert } from '../schema';
import { IMeetingRepository } from '@repo/core';
import { Meeting, CreateMeeting } from '@repo/schema';

export class DrizzleMeetingRepository implements IMeetingRepository {
  async create(data: CreateMeeting): Promise<Meeting> {
    const insertData: MeetingInsert = {
      title: data.title,
      date: data.date.split('T')[0], // Extract date part from ISO string
      participants: data.participants,
      status: 'active', // Default value since CreateMeeting doesn't include status
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
    const results = await db.select().from(meetings);
    return results.map((r) => this.mapToMeeting(r));
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

  private mapToMeeting(dbMeeting: MeetingSelect): Meeting {
    return {
      id: dbMeeting.id,
      title: dbMeeting.title,
      date: new Date(dbMeeting.date).toISOString(),
      participants: dbMeeting.participants,
      status: dbMeeting.status,
      createdAt: dbMeeting.createdAt.toISOString(),
    };
  }
}
