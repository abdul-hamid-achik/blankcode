/**
 * The rules of a context-selection exercise (vibecoding form E).
 *
 * The learner is asked something a model cannot answer unaided — write this
 * query against a schema it has never seen — and given a menu of sources it
 * could be shown, each with a token price. They pick what to hand over, then
 * answer. Being right is the floor; being right cheaply is the exercise.
 *
 * The instinct this is built to break is "more context is better". It is not:
 * context costs money, crowds the window, and past some point makes answers
 * worse. Knowing what the model actually needs to see is the skill, and it is
 * only visible when handing over everything is allowed but scored.
 *
 * No database and no model in here, same as the turn-budget rules — this is the
 * part that decides whether the exercise measures anything.
 */

export interface ContextSource {
  readonly id: string
  readonly label: string
  /** What showing this costs. Authored per exercise, not measured at runtime. */
  readonly tokens: number
}

export interface ContextExercise {
  readonly sources: readonly ContextSource[]
  /**
   * The smallest set that makes the question answerable.
   *
   * Authored, because "could a model have answered without this" is a judgement
   * about the task, not something derivable from the sources. It is what makes
   * an under-selection distinguishable from a lucky guess.
   */
  readonly required: readonly string[]
}

export interface Selection {
  readonly sourceIds: readonly string[]
}

export interface Cost {
  readonly tokens: number
  /** Ids asked for that this exercise does not define. */
  readonly unknown: readonly string[]
}

/**
 * What a selection costs.
 *
 * Duplicates are charged once — asking for the same source twice is a client
 * bug, not a purchase — and unknown ids are reported rather than silently
 * dropped, because silently dropping them makes a typo look like a cheap
 * correct answer.
 */
export function costOf(exercise: ContextExercise, selection: Selection): Cost {
  const byId = new Map(exercise.sources.map((source) => [source.id, source]))
  const seen = new Set<string>()
  const unknown: string[] = []
  let tokens = 0

  for (const id of selection.sourceIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const source = byId.get(id)
    if (!source) {
      unknown.push(id)
      continue
    }
    tokens += source.tokens
  }

  return { tokens, unknown }
}

/** The cheapest selection that could answer the question. */
export function minimalCost(exercise: ContextExercise): number {
  return costOf(exercise, { sourceIds: exercise.required }).tokens
}

export interface Grade {
  readonly correct: boolean
  /** Whether everything needed was handed over. */
  readonly sufficient: boolean
  readonly tokensSpent: number
  readonly minimalTokens: number
  /** Tokens spent on sources the answer did not need. */
  readonly tokensWasted: number
  /** Sources handed over that were not required. */
  readonly unnecessary: readonly string[]
  readonly unknown: readonly string[]
}

/**
 * Grades one attempt.
 *
 * `correct` and `sufficient` are kept apart on purpose. A learner can produce
 * the right answer without handing over what was needed — by knowing the domain,
 * or by guessing — and reporting that as a cheap win would teach exactly the
 * wrong lesson about what the model was working from. The pair says which
 * happened.
 */
export function grade(
  exercise: ContextExercise,
  selection: Selection,
  answerIsCorrect: boolean
): Grade {
  const cost = costOf(exercise, selection)
  const chosen = new Set(selection.sourceIds)

  const sufficient = exercise.required.every((id) => chosen.has(id))
  const requiredSet = new Set(exercise.required)
  const unnecessary = [...new Set(selection.sourceIds)].filter(
    (id) => !requiredSet.has(id) && exercise.sources.some((source) => source.id === id)
  )

  const minimal = minimalCost(exercise)

  return {
    correct: answerIsCorrect,
    sufficient,
    tokensSpent: cost.tokens,
    minimalTokens: minimal,
    // Only ever what was spent above the floor. A selection that is missing a
    // required source is cheaper than minimal, and calling that a negative
    // waste would read as a reward for under-selecting.
    tokensWasted: Math.max(0, cost.tokens - minimal),
    unnecessary,
    unknown: cost.unknown,
  }
}

/**
 * Whether the attempt passes.
 *
 * Both halves are required: right answer, and the model was actually given what
 * it needed to produce it. Efficiency is reported, never a pass condition — a
 * threshold there would push learners to under-select and hope, which is the
 * habit this is supposed to remove.
 */
export function passed(result: Grade): boolean {
  return result.correct && result.sufficient
}
