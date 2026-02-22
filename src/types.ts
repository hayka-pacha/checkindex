import { z } from 'zod';

export const IndexCheckRequestSchema = z
  .object({
    url: z.string().url().optional(),
    domain: z.string().min(1).optional(),
  })
  .refine((data) => data.url ?? data.domain, {
    message: 'Either url or domain must be provided',
  });

export type IndexCheckRequest = z.infer<typeof IndexCheckRequestSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const CheckMethodSchema = z.enum(['heuristic', 'google-cse']);
export type CheckMethod = z.infer<typeof CheckMethodSchema>;

export const HeuristicSignalsSchema = z.object({
  keywordsTop100: z.number().int().nonnegative(),
  traffic: z.number().nonnegative(),
  backlinks: z.number().int().nonnegative(),
  domainAgeYears: z.number().nonnegative().optional(),
});

export type HeuristicSignals = z.infer<typeof HeuristicSignalsSchema>;

export const IndexCheckResultSchema = z.object({
  indexed: z.boolean(),
  confidence: ConfidenceSchema,
  method: CheckMethodSchema,
  indexedPagesCount: z.number().int().nonnegative().optional(),
  signals: HeuristicSignalsSchema.optional(),
  cachedAt: z.string().datetime().optional(),
});

export type IndexCheckResult = z.infer<typeof IndexCheckResultSchema>;
