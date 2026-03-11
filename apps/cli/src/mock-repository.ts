import { IMeetingRepository } from "@repo/core";
import { Meeting, CreateMeeting } from "@repo/schema";

// Mock repository for CLI testing
export class MockMeetingRepository implements IMeetingRepository {
  private meetings: Map<string, Meeting> = new Map();

  async create(data: CreateMeeting): Promise<Meeting> {
    const meeting: Meeting = {
      id: crypto.randomUUID(),
      ...data,
      status: "active",
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

  async updateStatus(id: string, status: "active" | "completed"): Promise<Meeting> {
    const meeting = this.meetings.get(id);
    if (!meeting) {
      throw new Error("Meeting not found");
    }

    const updated = { ...meeting, status };
    this.meetings.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.meetings.delete(id);
  }
}
