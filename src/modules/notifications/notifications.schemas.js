import { z } from 'zod';

export const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  is_read: z.enum(['true', 'false']).optional(),
});
export const notificationIdSchema = z.object({ id: z.string().uuid() });