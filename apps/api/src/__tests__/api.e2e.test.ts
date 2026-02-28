import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../index';

describe('API E2E Tests', () => {
  let createdMeetingId: string;

  it('POST /api/meetings - should create a meeting', async () => {
    const response = await app.request('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Meeting',
        date: '2026-02-27T10:00:00Z',
        participants: ['Alice', 'Bob'],
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.title).toBe('Test Meeting');
    expect(data.participants).toEqual(['Alice', 'Bob']);
    expect(data.status).toBe('active');
    
    createdMeetingId = data.id;
  });

  it('GET /api/meetings - should list all meetings', async () => {
    const response = await app.request('/api/meetings');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.meetings).toBeInstanceOf(Array);
    expect(data.meetings.length).toBeGreaterThan(0);
  });

  it('GET /api/meetings/:id - should get a specific meeting', async () => {
    const response = await app.request(`/api/meetings/${createdMeetingId}`);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(createdMeetingId);
    expect(data.title).toBe('Test Meeting');
  });

  it('GET /api/meetings/:id - should return 404 for non-existent meeting', async () => {
    const response = await app.request('/api/meetings/non-existent-id');
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Meeting not found');
  });

  it('GET /health - should return health status', async () => {
    const response = await app.request('/health');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  it('GET /openapi.json - should return OpenAPI spec', async () => {
    const response = await app.request('/openapi.json');
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.openapi).toBe('3.0.0');
    expect(data.paths).toHaveProperty('/api/meetings');
  });
});
