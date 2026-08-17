/**
 * The free-plan meter as one mono line on the exercise action bar.
 *
 * The cap is the only thing that distinguishes Free from Pro. Showing it
 * only after the 11th submit is how people hit a wall they never saw.
 */

export interface PracticeQuota {
  paid: boolean
  submissionsRemaining: number | null
  submissionsLimit: number | null
  runsRemaining: number | null
  runsLimit: number | null
}

export function practiceQuotaLine(quota: PracticeQuota): string | null {
  if (quota.paid) return null

  const parts: string[] = []
  if (quota.submissionsRemaining !== null && quota.submissionsLimit !== null) {
    parts.push(`${quota.submissionsRemaining} of ${quota.submissionsLimit} submits left today`)
  }
  if (quota.runsRemaining !== null && quota.runsLimit !== null) {
    parts.push(`${quota.runsRemaining} runs`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}
