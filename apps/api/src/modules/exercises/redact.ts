/**
 * Strips the answers out of an exercise before it leaves the server.
 *
 * Both `/exercises/:id` and `/exercises/:id/progress` used to serialise the
 * whole DB row, which meant every response carried `solutionCode` — the
 * complete answer — plus `blanks[].solution`, the exact string for each
 * individual blank. Anyone with the Network tab open could read the answer to
 * any exercise without running anything, which defeats the entire premise of
 * the product.
 *
 * `testCode` is deliberately kept: the tests are what you are being measured
 * against, and seeing them is part of the exercise.
 */

interface BlankLike {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly placeholder: string
  readonly solution?: string
}

export interface RedactedBlank {
  readonly id: string
  readonly from: number
  readonly to: number
  readonly placeholder: string
}

export function redactBlank(blank: BlankLike): RedactedBlank {
  return { id: blank.id, from: blank.from, to: blank.to, placeholder: blank.placeholder }
}

/**
 * Removes `solutionCode` and every blank's `solution`. Accepts the raw Drizzle
 * row shape and returns it minus the secrets, preserving everything else
 * (including relations like `concept`).
 */
export function redactExercise<T extends Record<string, unknown>>(
  exercise: T
): Omit<T, 'solutionCode' | 'blanks'> & { blanks: RedactedBlank[] } {
  const {
    solutionCode: _solutionCode,
    blanks,
    ...rest
  } = exercise as T & {
    solutionCode?: unknown
    blanks?: BlankLike[] | null
  }

  return {
    ...(rest as Omit<T, 'solutionCode' | 'blanks'>),
    blanks: Array.isArray(blanks) ? blanks.map(redactBlank) : [],
  }
}

export function redactExercises<T extends Record<string, unknown>>(exercises: readonly T[]) {
  return exercises.map((exercise) => redactExercise(exercise))
}
