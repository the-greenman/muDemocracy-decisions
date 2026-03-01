import type { IMeetingRepository } from '../interfaces/i-meeting-repository';
import { CreateMeetingSchema } from '@repo/schema';
import type { Meeting, CreateMeeting } from '@repo/schema';

export class MeetingService {
  constructor(private readonly repo: IMeetingRepository) {}

  async create(data: CreateMeeting): Promise<Meeting> {
    // Validate input using Zod schema
    const validatedData = CreateMeetingSchema.parse(data);
    
    // Business logic: ensure at least one participant
    if (validatedData.participants.length === 0) {
      throw new Error('At least one participant is required');
    }

    // Delegate to repository
    return this.repo.create(validatedData);
  }

  async findById(id: string): Promise<Meeting | null> {
    if (!id) {
      throw new Error('Meeting ID is required');
    }
    return this.repo.findById(id);
  }

  async findAll(): Promise<Meeting[]> {
    return this.repo.findAll();
  }

  async update(id: string, data: Partial<Pick<CreateMeeting, 'title' | 'participants'>>): Promise<Meeting> {
    if (!id) {
      throw new Error('Meeting ID is required');
    }
    
    // Business logic: ensure at least one participant if updating participants
    if (data.participants !== undefined && data.participants.length === 0) {
      throw new Error('At least one participant is required');
    }
    
    return this.repo.update(id, data);
  }

  async updateStatus(id: string, status: 'active' | 'completed'): Promise<Meeting> {
    if (!id) {
      throw new Error('Meeting ID is required');
    }
    if (!['active', 'completed'].includes(status)) {
      throw new Error('Status must be either "active" or "completed"');
    }
    return this.repo.updateStatus(id, status);
  }
}
