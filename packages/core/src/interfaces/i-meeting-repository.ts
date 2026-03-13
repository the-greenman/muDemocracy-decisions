import { Meeting, CreateMeeting } from "@repo/schema";

export interface IMeetingRepository {
  create(data: CreateMeeting): Promise<Meeting>;
  findById(id: string): Promise<Meeting | null>;
  findAll(): Promise<Meeting[]>;
  update(
    id: string,
    data: Partial<Pick<CreateMeeting, "title" | "date" | "participants">>,
  ): Promise<Meeting>;
  updateStatus(id: string, status: "proposed" | "in_session" | "ended"): Promise<Meeting>;
  delete(id: string): Promise<boolean>;
}
