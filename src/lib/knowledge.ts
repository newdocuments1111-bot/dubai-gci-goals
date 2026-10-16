import { z } from 'zod';
import type { Tables } from '@/integrations/supabase/types';

export type KnowledgeFact = Tables<'uae_knowledge'>;

export const knowledgeSchema = z.object({
  topic: z.string().trim().min(1, 'Topic is required').max(200),
  fact: z.string().trim().min(1, 'Fact is required').max(10000),
  source: z.string().trim().max(500),
});
export type KnowledgeInput = z.infer<typeof knowledgeSchema>;

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

/** Facts older than 6 months need re-verification before the AI relies on them. */
export function needsReverify(fact: Pick<KnowledgeFact, 'last_verified'>, now = Date.now()) {
  const time = Date.parse(fact.last_verified);
  return !Number.isFinite(time) || now - time > SIX_MONTHS_MS;
}
