import { z } from '@hono/zod-openapi';

// Meeting Schema - Single Source of Truth
export const MeetingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required'),
  date: z.string().datetime({ offset: true }),
  participants: z.array(z.string()).min(1, 'At least one participant is required'),
  status: z.enum(['active', 'completed']).default('active'),
  createdAt: z.string().datetime({ offset: true }),
}).openapi('Meeting', {
  description: 'A meeting entity',
  example: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Meeting',
    date: '2026-02-27T10:00:00Z',
    participants: ['Alice', 'Bob'],
    status: 'active',
    createdAt: '2026-02-27T10:00:00Z',
  },
});

// Types inferred from Zod (never write manual types)
export type Meeting = z.infer<typeof MeetingSchema>;

// Input types for creation
export const CreateMeetingSchema = MeetingSchema.pick({
  title: true,
  date: true,
  participants: true,
}).extend({
  date: z.string().datetime({ offset: true }),
});

export type CreateMeeting = z.infer<typeof CreateMeetingSchema>;

// Update types
export const UpdateMeetingSchema = MeetingSchema.pick({
  title: true,
  status: true,
}).partial();

export type UpdateMeeting = z.infer<typeof UpdateMeetingSchema>;

// Export all schemas
export {
  // Re-export for convenience
  z,
};
