/**
 * Shared Continue / "what's next" selection.
 *
 * Due recall and new material are different jobs. Mixing them is how a
 * sitting that just closed a review sends the learner back into an
 * exercise they finished months ago — the next neighbour in track order
 * is almost always already completed.
 */

export interface ContinueCandidate {
  id: string
  title: string
  slug?: string
  difficulty?: string
  conceptName: string
  trackName: string
  sameConcept?: boolean
}

export type ContinueKind = 'due-recall' | 'new-material' | 'none'

export type ContinueSelection =
  | { kind: 'due-recall' | 'new-material'; next: ContinueCandidate }
  | { kind: 'none'; next: null }

export function dropPassedFromDue<T extends { id: string }>(
  due: readonly T[],
  passedIds: ReadonlySet<string>
): T[] {
  if (passedIds.size === 0) return [...due]
  return due.filter((item) => !passedIds.has(item.id))
}

export interface DueSessionState<T extends { id: string }> {
  dueExercises: T[]
  dueCount: number
  completedThisSession: number
  passedThisSession: string[]
}

/**
 * The pass is the sitting event, not the optional rating. Continue-without-
 * rating is the shipped onward path; if the id is only recorded in
 * completeReview, a return to Review hydrates from a stale payload through
 * an empty passedThisSession and puts the item back on the list.
 */
export function applyPassToDueQueue<T extends { id: string }>(
  state: DueSessionState<T>,
  exerciseId: string
): DueSessionState<T> {
  if (state.passedThisSession.includes(exerciseId)) {
    return {
      ...state,
      dueExercises: state.dueExercises.filter((item) => item.id !== exerciseId),
    }
  }

  const wasInQueue = state.dueExercises.some((item) => item.id === exerciseId)
  const treatAsDue = wasInQueue || (state.dueExercises.length === 0 && state.dueCount > 0)
  return {
    dueExercises: state.dueExercises.filter((item) => item.id !== exerciseId),
    dueCount: treatAsDue ? Math.max(0, state.dueCount - 1) : state.dueCount,
    completedThisSession: treatAsDue ? state.completedThisSession + 1 : state.completedThisSession,
    passedThisSession: [...state.passedThisSession, exerciseId],
  }
}

export function shouldNoteSittingPass(input: {
  status: string | undefined
  submissionId: string | undefined
  sittingSubmissionIds: ReadonlySet<string>
}): boolean {
  return (
    input.status === 'passed' &&
    !!input.submissionId &&
    input.sittingSubmissionIds.has(input.submissionId)
  )
}

export function shouldShowTrackFinished(
  whatsNext: { next: { id: string } | null; track: { slug: string; name: string } } | null
): boolean {
  return whatsNext !== null && whatsNext.next === null
}

export function selectContinueTarget(input: {
  due: readonly ContinueCandidate[]
  justPassedId?: string | null
  track: readonly ContinueCandidate[]
  completedIds: ReadonlySet<string>
}): ContinueSelection {
  const justPassed = input.justPassedId ?? null
  const stillDue = dropPassedFromDue(input.due, justPassed ? new Set([justPassed]) : new Set())
  const firstDue = stillDue[0]
  if (firstDue) {
    return { kind: 'due-recall', next: firstDue }
  }

  const completed = new Set(input.completedIds)
  if (justPassed) completed.add(justPassed)

  const unseen = input.track.find((item) => !completed.has(item.id))
  if (unseen) {
    return { kind: 'new-material', next: unseen }
  }

  return { kind: 'none', next: null }
}

/** Labels the two Continues so a due item cannot be read as new work. */
export function continueChrome(kind: ContinueKind): { eyebrow: string; verb: string } {
  if (kind === 'due-recall') {
    return { eyebrow: 'due recall', verb: 'Review again' }
  }
  if (kind === 'new-material') {
    return { eyebrow: 'new material', verb: 'Something new' }
  }
  return { eyebrow: 'caught up', verb: 'Nothing left' }
}
