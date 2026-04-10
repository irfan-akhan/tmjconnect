import { z } from 'zod';

export const acceptLinkingCodeSchema = z.object({
  code: z.string().length(6).toUpperCase(),
});
