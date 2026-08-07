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
 * `testCode` is stripped too, for every type. The comment that used to live
 * here said keeping it was deliberate — "seeing them is part of the exercise" —
 * but nothing in the client ever rendered it, and for review and turn-budget
 * exercises the exercise's own text promises the opposite: "you are graded on
 * tests you cannot see", while the suite sat in the JSON of the endpoint that
 * served it. A human needed the Network tab; an agent connected to the API
 * receives that JSON as its working context. Default-closed; a surface that
 * wants to show tests for a type where that is the point (blank exercises in
 * a future agent tool) opts in explicitly from the unredacted row.
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
): Omit<T, 'solutionCode' | 'blanks' | 'testCode'> & { blanks: RedactedBlank[] } {
  const {
    solutionCode: _solutionCode,
    testCode: _testCode,
    blanks,
    ...rest
  } = exercise as T & {
    solutionCode?: unknown
    testCode?: unknown
    blanks?: BlankLike[] | null
  }

  return {
    ...(rest as Omit<T, 'solutionCode' | 'blanks' | 'testCode'>),
    blanks: Array.isArray(blanks) ? blanks.map(redactBlank) : [],
  }
}

export function redactExercises<T extends Record<string, unknown>>(exercises: readonly T[]) {
  return exercises.map((exercise) => redactExercise(exercise))
}
