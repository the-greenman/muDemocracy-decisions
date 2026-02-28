// Services
export { MeetingService } from './src/services/meeting-service';

// Interfaces
export { IMeetingRepository } from './src/interfaces/i-meeting-repository';

// Re-export types from schema for convenience
export type { Meeting, CreateMeeting, UpdateMeeting } from '@repo/schema';
