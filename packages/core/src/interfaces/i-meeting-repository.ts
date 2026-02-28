import { Meeting, CreateMeeting } from '@repo/schema';

export interface IMeetingRepository {
  create(data: CreateMeeting): Promise<Meeting>;
  findById(id: string): Promise<Meeting | null>;
  findAll(): Promise<Meeting[]>;
  updateStatus(id: string, status: 'active' | 'completed'): Promise<Meeting>;
}
