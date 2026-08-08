/**
 * The AI tier ladder, in one place.
 *
 * Users pick a tier name; the mapping to gateway model ids lives here so
 * models can rotate without a migration or a settings write. `advanced`
 * requires a paid plan — the resolve function enforces that server-side and
 * falls back rather than erroring, because a lapsed subscription should
 * degrade a preference, not break a feature.
 */

export type AiTier = 'fast' | 'standard' | 'advanced'

export const AI_TIERS: Record<
  AiTier,
  { label: string; gatewayModel: string; paidOnly: boolean; blurb: string }
> = {
  fast: {
    label: 'Fast',
    gatewayModel: process.env['LLM_MODEL'] ?? 'deepseek/deepseek-v4-flash',
    paidOnly: false,
    blurb: 'Quick and cheap. Fine for most explanations.',
  },
  standard: {
    label: 'Standard',
    gatewayModel: 'anthropic/claude-haiku-4-5',
    paidOnly: false,
    blurb: 'Better judgement on nuance, still fast.',
  },
  advanced: {
    label: 'Advanced',
    gatewayModel: 'anthropic/claude-sonnet-4-5',
    paidOnly: true,
    blurb: 'The strongest reads. Pro plan.',
  },
}

export const DEFAULT_TIER: AiTier = 'fast'

export function isAiTier(value: unknown): value is AiTier {
  return value === 'fast' || value === 'standard' || value === 'advanced'
}

/** The gateway model id for a user's stored tier, entitlement enforced. */
export function resolveAiModel(storedTier: string | null | undefined, paid: boolean): string {
  const tier: AiTier = isAiTier(storedTier) ? storedTier : DEFAULT_TIER
  if (AI_TIERS[tier].paidOnly && !paid) return AI_TIERS['standard'].gatewayModel
  return AI_TIERS[tier].gatewayModel
}
