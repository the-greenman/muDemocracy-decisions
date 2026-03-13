/**
 * DrizzleMeetingRepository
 *
 * PostgreSQL-backed implementation of IMeetingRepository using Drizzle ORM.
 */

import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { meetings, MeetingSelect, MeetingInsert } from "../schema.js";
import { Meeting, CreateMeeting } from "@repo/schema";

const POSTGRES_FOREIGN_KEY_VIOLATION = "23503";

function toMeetingIsoDateTime(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid stored meeting date");
  }

  return parsed.toISOString();
}

export class DrizzleMeetingRepository {
  async create(data: CreateMeeting): Promise<Meeting> {
    const meetingDate = new Date(data.date);
    if (Number.isNaN(meetingDate.getTime())) {
      throw new Error("Invalid date format");
    }

    const insertData: MeetingInsert = {
      title: data.title,
      date: meetingDate,
      participants: data.participants,
      status: "proposed",
    };

    const result = await db.insert(meetings).values(insertData).returning();
    if (!result[0]) {
      throw new Error("Failed to create meeting");
    }
    return this.mapToMeeting(result[0]);
  }

  async findById(id: string): Promise<Meeting | null> {
    const [result] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);

    return result ? this.mapToMeeting(result) : null;
  }

  async findAll(): Promise<Meeting[]> {
    const result = await db.select().from(meetings).orderBy(meetings.date);
    return result.map(this.mapToMeeting);
  }

  async update(
    id: string,
    data: Partial<Pick<CreateMeeting, "title" | "date" | "participants">>,
  ): Promise<Meeting> {
    const updateData: Partial<MeetingInsert> = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.participants !== undefined) {
      updateData.participants = data.participants;
    }
    if (data.date !== undefined) {
      const parsedDate = new Date(data.date);
      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error("Invalid date format");
      }
      updateData.date = parsedDate;
    }

    const result = await db.update(meetings).set(updateData).where(eq(meetings.id, id)).returning();

    if (!result[0]) {
      throw new Error("Meeting not found");
    }

    return this.mapToMeeting(result[0]);
  }

  async updateStatus(id: string, status: "proposed" | "in_session" | "ended"): Promise<Meeting> {
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
    try {
      const [result] = await db.delete(meetings).where(eq(meetings.id, id)).returning();

      return !!result;
    } catch (error) {
      const postgresError = error as { code?: string; message?: string };
      if (postgresError.code === POSTGRES_FOREIGN_KEY_VIOLATION) {
        throw new Error("Meeting has dependent records and cannot be deleted");
      }

      throw error;
    }
  }

  private mapToMeeting(dbMeeting: MeetingSelect): Meeting {
    return {
      id: dbMeeting.id,
      title: dbMeeting.title,
      date: toMeetingIsoDateTime(dbMeeting.date),
      participants: dbMeeting.participants,
      status: dbMeeting.status,
      createdAt: dbMeeting.createdAt.toISOString(),
    };
  }
}
