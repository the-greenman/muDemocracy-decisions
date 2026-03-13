import type { IMeetingRepository } from "../interfaces/i-meeting-repository";
import { CreateMeetingSchema } from "@repo/schema";
import type { Meeting, CreateMeeting } from "@repo/schema";

const editableMeetingStatuses = ["proposed", "in_session", "ended"] as const;

export class MeetingService {
  constructor(private readonly repo: IMeetingRepository) {}

  async create(data: CreateMeeting): Promise<Meeting> {
    // Validate input using Zod schema
    const validatedData = CreateMeetingSchema.parse(data);

    // Business logic: ensure at least one participant
    if (validatedData.participants.length === 0) {
      throw new Error("At least one participant is required");
    }

    // Delegate to repository
    return this.repo.create(validatedData);
  }

  async findById(id: string): Promise<Meeting | null> {
    if (!id) {
      throw new Error("Meeting ID is required");
    }
    return this.repo.findById(id);
  }

  async findAll(): Promise<Meeting[]> {
    return this.repo.findAll();
  }

  async update(
    id: string,
    data: Partial<Pick<CreateMeeting, "title" | "date" | "participants">>,
  ): Promise<Meeting> {
    if (!id) {
      throw new Error("Meeting ID is required");
    }
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error("Meeting not found");
    }
    if (existing.status === "ended") {
      throw new Error("Ended meetings cannot be reopened or modified");
    }

    // Business logic: ensure at least one participant if updating participants
    if (data.participants !== undefined && data.participants.length === 0) {
      throw new Error("At least one participant is required");
    }

    return this.repo.update(id, data);
  }

  async updateStatus(id: string, status: "proposed" | "in_session" | "ended"): Promise<Meeting> {
    if (!id) {
      throw new Error("Meeting ID is required");
    }
    if (!editableMeetingStatuses.includes(status)) {
      throw new Error('Status must be one of "proposed", "in_session", or "ended"');
    }
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error("Meeting not found");
    }
    if (existing.status === "ended") {
      throw new Error("Ended meetings cannot be reopened or modified");
    }
    if (status === "proposed" && existing.status === "in_session") {
      throw new Error("In-session meetings cannot move back to proposed");
    }
    return this.repo.updateStatus(id, status);
  }

  async delete(id: string): Promise<boolean> {
    if (!id) {
      throw new Error("Meeting ID is required");
    }

    return this.repo.delete(id);
  }
}
