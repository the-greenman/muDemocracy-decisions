// Services
export { MeetingService } from './services/meeting-service';

// Interfaces
export type { IMeetingRepository } from './interfaces/i-meeting-repository';

// Re-export types from schema for convenience
export type { Meeting, CreateMeeting, UpdateMeeting } from '@repo/schema';
