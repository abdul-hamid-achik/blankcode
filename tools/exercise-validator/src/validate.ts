import {
  extractBlanks,
  generateStarterCode,
  parseExercise,
  stripBlankMarkers,
} from '@blankcode/exercise-parser'
import {
  BLANK_END_MARKER,
  BLANK_START_MARKER,
  checkTokenBalance,
  firstDivergentLine,
  renderStarterWithAnswers,
  scanRawBlanks,
} from './blanks.js'
import type { Finding, Severity } from './finding.js'
import { diagnoseFrontmatter } from './frontmatter.js'
import {
  columnOf,
  findAllOccurrences,
  findFirstFencedBlock,
  findFrontmatter,
  findHeadings,
  type FrontmatterBlock,
  indexSource,
  lineOf,
  type SourceIndex,
} from './source.js'
import { hasAssertion, knowsAssertions, normalizeLang, segmentTests } from './testcode.js'

export interface ExerciseSource {
  /** Repo-relative path, used verbatim in the report. */
  readonly file: string
  readonly text: string
}

/** The importer's own extraction regex — replicated so we report what it stores. */
const IMPORTER_TESTS_RE = /## Tests\s*```[\w]*\n([\s\S]*?)```/
const TESTS_HEADING_RE = /^[ \t]{0,3}##[ \t]+Tests[ \t]*$/m
const USAGE_HEADING_RE = /\b(usage|example|examples|expected output|sample)\b/i
const QUOTE_AMBIGUOUS_LANGS = new Set(['python', 'typescript'])
const BIG_EXERCISE_BLANKS = 8
const BIG_EXERCISE_LINES = 60

class FindingCollector {
  readonly findings: Finding[] = []

  constructor(
    private readonly file: string,
    private readonly index: SourceIndex
  ) {}

  at(severity: Severity, rule: string, offset: number, message: string): void {
    this.findings.push({
      file: this.file,
      line: lineOf(this.index, offset),
      column: columnOf(this.index, offset),
      severity,
      rule,
      message,
    })
  }

  atLine(severity: Severity, rule: string, line: number, message: string): void {
    this.findings.push({ file: this.file, line, column: 1, severity, rule, message })
  }
}

interface LenientFrontmatter {
  readonly type: string | null
  readonly difficulty: string | null
}

/**
 * Reads the two keys that steer the rest of the checks without going through the
 * schema, so a file whose frontmatter is *invalid* still gets its blanks checked
 * instead of stopping at the first fatal.
 */
function readLenientFrontmatter(raw: string): LenientFrontmatter {
  const pick = (key: string): string | null => {
    const match = new RegExp(`^${key}:[ \\t]*(.+?)[ \\t]*$`, 'm').exec(raw)
    const value = match?.[1]?.replace(/^['"]|['"]$/g, '')
    return value ? value : null
  }
  return { type: pick('type'), difficulty: pick('difficulty') }
}

/**
 * The exercise language comes from the track directory, not the fence — nothing
 * in the frontmatter or the importer records a language, and the runner image is
 * chosen per track. The fence info string only drives syntax highlighting, so it
 * is checked against this rather than trusted.
 */
const TRACK_LANGUAGES: Record<string, string> = {
  go: 'go',
  python: 'python',
  rust: 'rust',
  typescript: 'typescript',
  react: 'typescript',
  vue: 'typescript',
}

export function trackLanguage(file: string): string {
  const parts = file.split('/')
  const trackIndex = parts.indexOf('tracks')
  const track = trackIndex === -1 ? (parts[0] ?? '') : (parts[trackIndex + 1] ?? '')
  return TRACK_LANGUAGES[track] ?? ''
}

function frontmatterKeyOffset(frontmatter: FrontmatterBlock | null, key: string): number {
  if (!frontmatter) return 0
  const match = new RegExp(`^${key}:`, 'm').exec(frontmatter.raw)
  return frontmatter.rawStart + (match?.index ?? 0)
}

/** 1-based line of `slug:` inside the file, for corpus-level duplicate reporting. */
export function locateSlug(text: string): { slug: string; line: number } | null {
  const frontmatter = findFrontmatter(text)
  if (!frontmatter) return null
  const match = /^slug:[ \t]*(.+?)[ \t]*$/m.exec(frontmatter.raw)
  const slug = match?.[1]?.replace(/^['"]|['"]$/g, '')
  if (!slug || match?.index === undefined) return null
  const index = indexSource(text)
  return { slug, line: lineOf(index, frontmatter.rawStart + match.index) }
}

function checkFrontmatter(collect: FindingCollector, text: string, index: SourceIndex): void {
  const frontmatter = findFrontmatter(text)
  if (!frontmatter) {
    collect.at(
      'fatal',
      'frontmatter-missing',
      0,
      'No YAML frontmatter block. The importer cannot read slug/title/difficulty and skips the file.'
    )
    return
  }

  const parsed = parseExercise(text)
  if (parsed.success) return

  const reason = parsed.errors.join('; ')
  if (/no code block found/i.test(reason)) {
    // Reported separately by checkStarterBlock with a better location.
    return
  }

  // The Effect schema error carries no location, so re-parse the YAML to point
  // at the offending line.
  const diagnostics = diagnoseFrontmatter(frontmatter.raw)
  if (diagnostics.length === 0) {
    collect.at(
      'fatal',
      'frontmatter-invalid',
      frontmatter.start,
      `Frontmatter fails schema validation, so the importer skips this file entirely: ${reason.split('\n')[0] ?? reason}`
    )
    return
  }

  for (const diagnostic of diagnostics) {
    collect.at(
      'fatal',
      'frontmatter-invalid',
      frontmatter.rawStart + diagnostic.offset,
      `${diagnostic.message} The importer skips this file entirely.`
    )
  }
}

interface StarterInfo {
  readonly lang: string
  readonly body: string
  readonly bodyStart: number
  readonly fenceStart: number
  readonly fenceEnd: number
}

function checkStarterBlock(
  collect: FindingCollector,
  text: string,
  bodyStart: number
): StarterInfo | null {
  const block = findFirstFencedBlock(text, bodyStart)
  if (!block) {
    collect.at(
      'fatal',
      'code-block-missing',
      bodyStart,
      'No fenced code block in the body. `parseExercise` fails and the importer skips this file.'
    )
    return null
  }

  for (const heading of findHeadings(text, bodyStart, block.fenceStart)) {
    if (USAGE_HEADING_RE.test(heading.text)) {
      collect.at(
        'error',
        'starter-not-first',
        heading.offset,
        `Heading "${heading.text}" precedes the first fenced block, so the block stored as the editor's starter code is probably this sample, not the skeleton. The starter must be the FIRST fenced block (AGENTS.md authoring rule 8).`
      )
    }
  }

  return {
    lang: block.lang,
    body: block.body,
    bodyStart: block.bodyStart,
    fenceStart: block.fenceStart,
    fenceEnd: block.fenceEnd,
  }
}

function checkMarkerPlacement(collect: FindingCollector, text: string, starter: StarterInfo): void {
  for (const marker of [BLANK_START_MARKER, BLANK_END_MARKER]) {
    for (const offset of findAllOccurrences(text, marker)) {
      if (offset >= starter.fenceStart && offset < starter.fenceEnd) continue
      collect.at(
        'error',
        'marker-outside-starter',
        offset,
        `Blank marker \`${marker}\` appears outside the first fenced block. Only the starter block is scanned for blanks; this one is stored verbatim.`
      )
    }
  }
}

function checkBlanks(
  collect: FindingCollector,
  starter: StarterInfo,
  exerciseType: string,
  lang: string
): number {
  const scan = scanRawBlanks(starter.body)

  if (scan.unclosedAt !== null) {
    collect.at(
      'fatal',
      'blank-unclosed',
      starter.bodyStart + scan.unclosedAt,
      `\`${BLANK_START_MARKER}\` has no matching \`${BLANK_END_MARKER}\`. \`extractBlanks\` throws and the importer skips this file.`
    )
    return scan.blanks.length
  }

  if (exerciseType === 'challenge' && scan.blanks.length > 0) {
    collect.at(
      'error',
      'challenge-has-blanks',
      starter.bodyStart + (scan.blanks[0]?.startOffset ?? 0),
      'Exercise is `type: challenge`, so the parser extracts no blanks — the markers are stored verbatim in the starter code the student sees.'
    )
  }

  if (exerciseType !== 'challenge' && scan.blanks.length === 0) {
    collect.at(
      'error',
      'blank-none',
      starter.fenceStart,
      'Blank exercise has no `___blank_start___` markers, so there is nothing for the student to fill in.'
    )
  }

  for (const blank of scan.blanks) {
    const offset = starter.bodyStart + blank.startOffset
    const label = JSON.stringify(blank.answer)

    if (blank.raw.includes('\n')) {
      collect.at(
        'fatal',
        'blank-newline',
        offset,
        `Blank spans a newline (${label}). Blanks render as a single-line <input>, so this answer can never be typed and its feedback is permanently "incorrect" (authoring rule 1).`
      )
    }

    if (blank.answer.length === 0) {
      collect.at('error', 'blank-empty', offset, 'Blank has an empty answer.')
      continue
    }

    if (blank.answer.startsWith('_') || blank.answer.endsWith('_')) {
      collect.at(
        'fatal',
        'blank-underscore-boundary',
        offset,
        `Blank answer ${label} starts or ends with "_", so it merges with the underscore-delimited marker — the parsed answer and the stored solution are both corrupted (authoring rule 2). Widen the blank so it has non-underscore text at both boundaries.`
      )
    }

    if (blank.raw !== blank.answer) {
      collect.at(
        'error',
        'blank-padding',
        offset,
        `Blank has whitespace padding inside the markers (${JSON.stringify(blank.raw)}). The answer is trimmed but the replaced span is not, so the starter offsets drift (authoring rule 3).`
      )
    }

    const balance = checkTokenBalance(blank.answer, lang)
    if (!balance.balanced) {
      collect.at(
        'error',
        'blank-unbalanced',
        offset,
        `Blank answer ${label} is not token-balanced (${balance.reason}) — it splits a pair across the blank edge (authoring rule 4).`
      )
    }

    if (QUOTE_AMBIGUOUS_LANGS.has(lang) && /['"]/.test(blank.answer)) {
      collect.at(
        'warning',
        'blank-ambiguous-quotes',
        offset,
        `Blank answer ${label} contains a string literal in a language where quote style is free. Per-blank feedback is an exact trimmed compare, so the equally-correct other quote style is marked wrong (authoring rule 5).`
      )
    }
  }

  return scan.blanks.length
}

function checkRoundTrip(collect: FindingCollector, starter: StarterInfo): void {
  const solution = starter.body.trim()
  if (!solution.includes(BLANK_START_MARKER)) return

  let blanks: ReturnType<typeof extractBlanks>
  try {
    blanks = extractBlanks(solution)
  } catch {
    return // already reported as blank-unclosed
  }

  const { starterCode, blanksInStarter } = generateStarterCode(solution, blanks)

  if (blanksInStarter.length !== blanks.length) {
    collect.at(
      'fatal',
      'blank-unrenderable',
      starter.fenceStart,
      `${blanks.length} blanks parsed but only ${blanksInStarter.length} could be located in the generated starter code. The missing blanks are never rendered as inputs, so the exercise cannot be completed.`
    )
  }

  const expected = stripBlankMarkers(solution)
  const rebuilt = renderStarterWithAnswers(starterCode, blanksInStarter)
  if (rebuilt !== expected) {
    const line = firstDivergentLine(rebuilt, expected)
    collect.at(
      'fatal',
      'roundtrip-mismatch',
      starter.bodyStart,
      `Filling every blank with its canonical answer does not reproduce the stored solution${
        line === null ? '' : ` (first difference at solution line ${line})`
      }. A student who answers every blank correctly still submits code that differs from the solution.`
    )
  }
}

function checkTestsSection(collect: FindingCollector, text: string, lang: string): void {
  const heading = TESTS_HEADING_RE.exec(text)
  if (!heading) {
    collect.at(
      'fatal',
      'tests-missing',
      text.length,
      'No `## Tests` section. The importer stores an empty `testCode`, so submissions can never be graded.'
    )
    return
  }

  const headingOffset = heading.index
  const match = IMPORTER_TESTS_RE.exec(text)
  if (!match) {
    collect.at(
      'fatal',
      'tests-unparsable',
      headingOffset,
      'The importer regex `/## Tests\\s*```[\\w]*\\n/` finds no fenced block after the `## Tests` heading — the fence must follow the heading with only whitespace between them. `testCode` is stored empty.'
    )
    return
  }

  const testCode = (match[1] ?? '').trim()
  if (testCode.length === 0) {
    collect.at(
      'fatal',
      'tests-empty',
      headingOffset,
      'The `## Tests` fenced block is empty, so `testCode` is stored empty and submissions can never be graded.'
    )
    return
  }

  const codeOffset = text.indexOf(match[1] ?? '', match.index)

  if (knowsAssertions(lang)) {
    for (const segment of segmentTests(lang, match[1] ?? '')) {
      if (hasAssertion(lang, segment.body)) continue
      const label = segment.name ? `Test \`${segment.name}\`` : 'The test block'
      collect.at(
        'warning',
        'tests-no-assertions',
        codeOffset + segment.offset,
        `${label} contains no assertion, so it only fails if the code does not compile or panics — it cannot tell a correct implementation from a wrong one (authoring rule 7).`
      )
    }
  }

  // Note: authoring rule 11 ("imports may only reference ./solution") is NOT
  // checked here. The TypeScript executor rewrites every relative specifier to
  // './solution' before running (executors/typescript.executor.ts), so a literal
  // check flags 26 files that actually work.
}

function checkDifficulty(
  collect: FindingCollector,
  file: string,
  difficulty: string | null,
  difficultyOffset: number,
  blankCount: number,
  solutionLines: number
): void {
  if (difficulty !== 'beginner') return
  const concept = file.split('/').at(-2) ?? ''

  if (/advanced/i.test(concept)) {
    collect.at(
      'warning',
      'difficulty-suspect',
      difficultyOffset,
      `\`difficulty: beginner\` inside concept "${concept}". Set difficulty deliberately (authoring rule 12).`
    )
    return
  }

  if (blankCount >= BIG_EXERCISE_BLANKS || solutionLines >= BIG_EXERCISE_LINES) {
    collect.at(
      'warning',
      'difficulty-suspect',
      difficultyOffset,
      `\`difficulty: beginner\` on an exercise with ${blankCount} blanks across ${solutionLines} lines. Set difficulty deliberately (authoring rule 12).`
    )
  }
}

/**
 * A challenge must carry a reference solution in a `## Solution` section.
 *
 * Without one there is nothing to check the tests against, so nobody knows the
 * exercise is solvable — and a learner who gets stuck on a broken one has no
 * way to tell whose fault it is. Fatal because the exercise imports fine and
 * looks complete; the defect is invisible until someone tries to solve it.
 *
 * Blank exercises are exempt: their first code block *is* the annotated
 * solution, so they have always had one.
 */
function checkChallengeSolution(
  collect: FindingCollector,
  text: string,
  exerciseType: string,
  bodyStart: number
): void {
  if (exerciseType !== 'challenge') return

  const heading = /^##\s+Solution\s*$/im.exec(text)
  if (!heading) {
    collect.at(
      'fatal',
      'challenge-no-solution',
      bodyStart,
      'Challenge has no `## Solution` section, so its reference solution is the empty starter stub and nothing can verify the exercise is solvable. Add the section and check it with `bun run content:verify`.'
    )
    return
  }

  const after = text.slice(heading.index + heading[0].length)
  const nextHeading = after.search(/^##\s+/m)
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading)
  if (!/```[\w]*\n[\s\S]*?```/.test(section)) {
    collect.at(
      'fatal',
      'challenge-no-solution',
      heading.index,
      '`## Solution` section contains no fenced code block, so the reference solution parses as empty.'
    )
  }
}

export function validateExerciseSource(source: ExerciseSource): Finding[] {
  const { file, text } = source
  const index = indexSource(text)
  const collect = new FindingCollector(file, index)

  const frontmatter = findFrontmatter(text)
  checkFrontmatter(collect, text, index)
  const lenient = frontmatter
    ? readLenientFrontmatter(frontmatter.raw)
    : { slug: null, type: null, difficulty: null }

  const bodyStart = frontmatter?.bodyStart ?? 0
  const starter = checkStarterBlock(collect, text, bodyStart)
  const lang = trackLanguage(file)

  if (starter) {
    // The schema defaults `type` to 'blank', so an unset type means blank.
    const exerciseType = lenient.type ?? 'blank'
    if (lang && starter.lang && normalizeLang(starter.lang) !== lang) {
      collect.at(
        'warning',
        'fence-lang-mismatch',
        starter.fenceStart,
        `Starter block is fenced as \`${starter.lang}\` but this is a ${lang} track, so the editor highlights it with the wrong grammar.`
      )
    }
    checkMarkerPlacement(collect, text, starter)
    checkChallengeSolution(collect, text, exerciseType, bodyStart)
    const blankCount = checkBlanks(collect, starter, exerciseType, lang)
    if (exerciseType !== 'challenge') checkRoundTrip(collect, starter)
    checkTestsSection(collect, text, lang)
    checkDifficulty(
      collect,
      file,
      lenient.difficulty,
      frontmatterKeyOffset(frontmatter, 'difficulty'),
      blankCount,
      starter.body.trim().split('\n').length
    )
  } else {
    checkTestsSection(collect, text, lang)
  }

  return collect.findings
}

export interface CorpusReport {
  readonly findings: readonly Finding[]
  readonly fileCount: number
}

export function validateCorpus(sources: readonly ExerciseSource[]): CorpusReport {
  const findings: Finding[] = []
  for (const source of sources) {
    findings.push(...validateExerciseSource(source))
  }
  findings.push(...checkSlugUniqueness(sources))
  return { findings, fileCount: sources.length }
}

/**
 * The importer upserts on `(conceptId, slug)`. Two files sharing a slug inside
 * one concept silently overwrite each other; across concepts they survive but
 * collide in every URL and lookup. Both are treated as fatal.
 */
export function checkSlugUniqueness(sources: readonly ExerciseSource[]): Finding[] {
  const bySlug = new Map<string, Array<{ file: string; line: number }>>()

  for (const source of sources) {
    const located = locateSlug(source.text)
    if (!located) continue
    const bucket = bySlug.get(located.slug) ?? []
    bucket.push({ file: source.file, line: located.line })
    bySlug.set(located.slug, bucket)
  }

  const findings: Finding[] = []
  for (const [slug, entries] of bySlug) {
    if (entries.length < 2) continue
    for (const entry of entries) {
      const others = entries.filter((other) => other.file !== entry.file).map((other) => other.file)
      findings.push({
        file: entry.file,
        line: entry.line,
        column: 1,
        severity: 'fatal',
        rule: 'slug-duplicate',
        message: `Slug "${slug}" is also used by ${others.join(', ')}. The importer upserts on (conceptId, slug), so one of these silently overwrites the other (authoring rule 9).`,
      })
    }
  }

  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
}
