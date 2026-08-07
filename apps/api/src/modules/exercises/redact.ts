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

interface ContextSourcesLike {
  readonly sources?: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly tokens: number
    readonly content?: unknown
  }> | null
  readonly required?: unknown
  readonly accept?: unknown
}

/**
 * A context-selection exercise's `contextSources` carries three secrets:
 * `required` (which sources the question actually needs — the whole answer),
 * `accept` (the grading regex), and each source's `content` (the thing the
 * session sells you token by token). Only the menu is public: id, label,
 * price. The contents are delivered one purchase at a time by the session
 * flow, which is the exercise.
 */
export interface RedactedContextSources {
  readonly sources: ReadonlyArray<{ id: string; label: string; tokens: number }>
}

function redactContextSources(value: unknown): RedactedContextSources | null {
  const raw = value as ContextSourcesLike | null | undefined
  if (!raw || !Array.isArray(raw.sources)) return null
  return {
    sources: raw.sources.map((s) => ({ id: s.id, label: s.label, tokens: s.tokens })),
  }
}

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
    contextSources,
    ...rest
  } = exercise as T & {
    solutionCode?: unknown
    testCode?: unknown
    blanks?: BlankLike[] | null
    contextSources?: unknown
  }

  return {
    ...(rest as Omit<T, 'solutionCode' | 'blanks' | 'testCode'>),
    blanks: Array.isArray(blanks) ? blanks.map(redactBlank) : [],
    ...(contextSources !== undefined
      ? { contextSources: redactContextSources(contextSources) }
      : {}),
  }
}

export function redactExercises<T extends Record<string, unknown>>(exercises: readonly T[]) {
  return exercises.map((exercise) => redactExercise(exercise))
}
