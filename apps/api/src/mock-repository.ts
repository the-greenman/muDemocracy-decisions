import { IMeetingRepository } from "@repo/core";
import { Meeting, CreateMeeting } from "@repo/schema";

// Mock repository for Phase 0 testing
// In Phase 1, this will be replaced with DrizzleMeetingRepository
export class MockMeetingRepository implements IMeetingRepository {
  private meetings: Map<string, Meeting> = new Map();

  async create(data: CreateMeeting): Promise<Meeting> {
    const meeting: Meeting = {
      id: crypto.randomUUID(),
      ...data,
      status: "proposed",
      createdAt: new Date().toISOString(),
    };

    this.meetings.set(meeting.id, meeting);
    return meeting;
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.meetings.get(id) || null;
  }

  async findAll(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async update(
    id: string,
    data: Partial<Pick<CreateMeeting, "title" | "date" | "participants">>,
  ): Promise<Meeting> {
    const meeting = this.meetings.get(id);
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const updated: Meeting = {
      ...meeting,
      ...data,
    };

    this.meetings.set(id, updated);
    return updated;
  }

  async updateStatus(id: string, status: "proposed" | "in_session" | "ended"): Promise<Meeting> {
    const existingMeeting = this.meetings.get(id);
    if (!existingMeeting) {
      throw new Error("Meeting not found");
    }

    const updatedMeeting = { ...existingMeeting, status };
    this.meetings.set(id, updatedMeeting);
    return updatedMeeting;
  }

  async delete(id: string): Promise<boolean> {
    return this.meetings.delete(id);
  }
}
