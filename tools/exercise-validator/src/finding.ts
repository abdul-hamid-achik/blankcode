/**
 * A finding is one rule violation located at a single point in one file.
 *
 * Severity semantics — these are load bearing, the CLI exit code depends on them:
 *
 * - `fatal`   The corpus is already broken. Either the importer skips the file
 *             outright, or it writes a record that is wrong/unusable in the DB
 *             (a lost slug, a corrupted canonical answer, an unanswerable blank,
 *             an exercise with no tests). Always exits non-zero.
 * - `error`   The exercise imports and renders, but a documented authoring rule
 *             is violated in a way that produces a bad exercise (starter block is
 *             actually a usage sample, a blank that splits a token pair, padding
 *             that drifts offsets). Exits non-zero only with `--strict`.
 * - `warning` Quality signal that needs a human judgement call (difficulty
 *             calibration, ambiguous answers, tests with no assertions).
 */
export type Severity = 'fatal' | 'error' | 'warning'

export const SEVERITIES: readonly Severity[] = ['fatal', 'error', 'warning']

export interface Finding {
  /** Repo-relative path of the markdown file. */
  readonly file: string
  /** 1-based line number. */
  readonly line: number
  /** 1-based column number. */
  readonly column: number
  readonly severity: Severity
  /** Stable kebab-case rule id, used for grouping and for suppression. */
  readonly rule: string
  readonly message: string
}

export interface SeverityCounts {
  readonly fatal: number
  readonly error: number
  readonly warning: number
}

export function countBySeverity(findings: readonly Finding[]): SeverityCounts {
  let fatal = 0
  let error = 0
  let warning = 0
  for (const finding of findings) {
    if (finding.severity === 'fatal') fatal++
    else if (finding.severity === 'error') error++
    else warning++
  }
  return { fatal, error, warning }
}

export function countByRule(findings: readonly Finding[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const finding of findings) {
    counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1)
  }
  return counts
}

/** Deterministic ordering: severity, then file, then position, then rule. */
export function sortFindings(findings: readonly Finding[]): Finding[] {
  const rank = (severity: Severity) => SEVERITIES.indexOf(severity)
  return findings.toSorted((a, b) => {
    if (a.severity !== b.severity) return rank(a.severity) - rank(b.severity)
    if (a.file !== b.file) return a.file < b.file ? -1 : 1
    if (a.line !== b.line) return a.line - b.line
    if (a.column !== b.column) return a.column - b.column
    return a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0
  })
}
