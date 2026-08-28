import { z } from 'zod';

export const relevanceCheckSchema = z.object({
  relevant: z.boolean(),
  reasons: z.array(z.string()),
});
