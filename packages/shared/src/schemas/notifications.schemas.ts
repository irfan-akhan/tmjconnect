import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateNotificationPrefsSchema = z.object({
  exercise_reminders: z.boolean().optional(),
  symptom_checkin: z.boolean().optional(),
  provider_messages: z.boolean().optional(),
  report_updates: z.boolean().optional(),
  tips_updates: z.boolean().optional(),
  email_digest: z.enum(['instant', 'daily', 'weekly', 'off']).optional(),
});
