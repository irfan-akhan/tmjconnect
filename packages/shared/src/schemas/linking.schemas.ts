import { z } from 'zod';
import { commonListQuerySchema } from './common.schemas';

export const acceptLinkingCodeSchema = z.object({
  code: z.string().length(6).toUpperCase(),
});

export const linkingLinksQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['linked_at', 'first_name', 'last_name', 'email']).optional(),
});

export const linkingCodesQuerySchema = commonListQuerySchema.extend({
  sortBy: z.enum(['created_at', 'expires_at', 'status']).optional(),
});
