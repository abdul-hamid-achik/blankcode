import type { BlankRegionInStarter } from './types/index.js'

/**
 * Round-tripping a blank exercise between starter code and submitted code.
 *
 * Both sides need this: the editor reconstructs full source from
 * (starter + values) before submitting, and the API re-extracts the values to
 * grade each blank. It lives here so the two can never drift — grading against
 * a different extraction than the one that produced the code would mark correct
 * answers wrong.
 */

/** Rebuilds the full source by substituting each blank's value into the starter. */
export function reconstructCode(
  starterCode: string,
  blanks: readonly BlankRegionInStarter[],
  values: ReadonlyMap<string, string>
): string {
  // Replace from the end so earlier offsets stay valid as lengths change.
  const sorted = [...blanks].sort((a, b) => b.from - a.from)
  let result = starterCode

  for (const blank of sorted) {
    const value = values.get(blank.id) ?? blank.placeholder
    result = result.slice(0, blank.from) + value + result.slice(blank.to)
  }

  return result
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Recovers the values a user typed from a previously reconstructed string.
 *
 * The starter is `F0 B0 F1 B1 ... Fn`, where `F` are fixed segments and `B` are
 * blanks. Anchoring the whole thing as one regex makes the engine backtrack so
 * that *every* fixed segment lines up, including the tail. A forward scan that
 * commits to the first match of each segment silently truncates any value
 * containing that segment — typing `f(x)` before a `)` cut the value to `f(x`,
 * and because drafts are stored as reconstructed code and re-extracted on load,
 * the truncation compounded on every reload.
 *
 * Returns an empty map when the saved code no longer matches the starter's
 * fixed text (a stale draft from before the exercise was edited); recovering
 * half of it would splice answers into the wrong blanks.
 */
export function extractBlankValues(
  savedCode: string,
  starterCode: string,
  blanks: readonly BlankRegionInStarter[]
): Map<string, string> {
  const values = new Map<string, string>()
  if (blanks.length === 0) return values

  const sorted = [...blanks].sort((a, b) => a.from - b.from)

  const fixedSegments: string[] = []
  let cursor = 0
  for (const blank of sorted) {
    fixedSegments.push(starterCode.slice(cursor, blank.from))
    cursor = blank.to
  }
  fixedSegments.push(starterCode.slice(cursor))

  const pattern = fixedSegments.map(escapeRegExp).join('([\\s\\S]*?)')
  const match = new RegExp(`^${pattern}$`).exec(savedCode)

  if (!match) return new Map()

  sorted.forEach((blank, i) => values.set(blank.id, match[i + 1] ?? ''))
  return values
}

export type BlankVerdict = 'correct' | 'incorrect'

/**
 * Grades each blank by comparing the submitted value to its solution.
 *
 * Deliberately server-side: the comparison needs `blank.solution`, and shipping
 * that to the browser hands over the answer to every exercise.
 */
export function gradeBlanks(
  submittedCode: string,
  starterCode: string,
  blanks: readonly (BlankRegionInStarter & { solution?: string })[]
): Record<string, BlankVerdict> | null {
  if (blanks.length === 0) return null

  const values = extractBlankValues(submittedCode, starterCode, blanks)

  // Extraction returns nothing when the submission no longer lines up with the
  // starter's fixed text — an edited exercise, or code that did not come from
  // the blank editor. Reporting every blank as wrong there contradicts a
  // passing test run and tells the learner nothing true, so say nothing.
  if (values.size === 0) return null

  const verdicts: Record<string, BlankVerdict> = {}
  for (const blank of blanks) {
    const submitted = (values.get(blank.id) ?? '').trim()
    const expected = (blank.solution ?? '').trim()
    verdicts[blank.id] = submitted === expected ? 'correct' : 'incorrect'
  }

  return verdicts
}
