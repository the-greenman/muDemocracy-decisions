import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DrizzleMeetingRepository } from '@repo/db';
import { MeetingService } from '@repo/core';

const TEST_DB_URL = 'postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev';

describe('Meeting Integration Tests', () => {
  let repo: DrizzleMeetingRepository;
  let service: MeetingService;
  
  beforeAll(async () => {
    // Override DATABASE_URL for tests
    process.env.DATABASE_URL = TEST_DB_URL;
    repo = new DrizzleMeetingRepository();
    service = new MeetingService(repo);
  });
  
  it('should create and retrieve a meeting', async () => {
    const meetingData = {
      title: 'Integration Test Meeting',
      date: new Date().toISOString(),
      participants: ['Alice', 'Bob'],
    };
    
    // Create meeting
    const created = await service.create(meetingData);
    expect(created).toBeDefined();
    expect(created.title).toBe(meetingData.title);
    expect(created.participants).toEqual(meetingData.participants);
    
    // Retrieve meeting
    const found = await service.findById(created.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.title).toBe(meetingData.title);
  });
  
  it('should list all meetings', async () => {
    const meetings = await service.findAll();
    expect(Array.isArray(meetings)).toBe(true);
    expect(meetings.length).toBeGreaterThan(0);
  });
  
  it('should update meeting status', async () => {
    // First create a meeting
    const meetingData = {
      title: 'Status Update Test',
      date: new Date().toISOString(),
      participants: ['Charlie'],
    };
    
    const created = await service.create(meetingData);
    
    // Update status
    const updated = await service.updateStatus(created.id, 'completed');
    expect(updated).toBeDefined();
    expect(updated?.status).toBe('completed');
  });
  
  afterAll(async () => {
    // Cleanup if needed
  });
});
