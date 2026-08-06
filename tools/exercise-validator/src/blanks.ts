import { BLANK_END_MARKER, BLANK_START_MARKER } from '@blankcode/exercise-parser'

/**
 * A blank exactly as it appears in the source, *before* the parser trims it.
 *
 * `extractBlanks` in the parser returns the trimmed answer only, which is
 * precisely the information the padding rule needs to see, so this module
 * re-scans the raw block. The scan alternates start/end marker lookups in the
 * same order the parser does, so the spans line up one-for-one.
 */
export interface RawBlank {
  /** 0-based ordinal within the block. */
  readonly ordinal: number
  /** Offset of the start marker within the scanned code. */
  readonly startOffset: number
  /** Offset just past the end marker. */
  readonly endOffset: number
  /** Text between the markers, exactly as written. */
  readonly raw: string
  /** `raw.trim()` — what the parser stores as the canonical answer. */
  readonly answer: string
}

export interface RawBlankScan {
  readonly blanks: readonly RawBlank[]
  /** A start marker with no matching end marker (the parser throws on this). */
  readonly unclosedAt: number | null
}

export function scanRawBlanks(code: string): RawBlankScan {
  const blanks: RawBlank[] = []
  let cursor = 0
  let ordinal = 0

  while (cursor < code.length) {
    const start = code.indexOf(BLANK_START_MARKER, cursor)
    if (start === -1) break
    const answerStart = start + BLANK_START_MARKER.length
    const end = code.indexOf(BLANK_END_MARKER, answerStart)
    if (end === -1) return { blanks, unclosedAt: start }

    const raw = code.slice(answerStart, end)
    blanks.push({
      ordinal,
      startOffset: start,
      endOffset: end + BLANK_END_MARKER.length,
      raw,
      answer: raw.trim(),
    })
    ordinal++
    cursor = end + BLANK_END_MARKER.length
  }

  return { blanks, unclosedAt: null }
}

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
const CLOSERS = new Set([')', ']', '}'])

export interface BalanceResult {
  readonly balanced: boolean
  readonly reason?: string
}

/** Scans forward from the opening quote at `start`; returns the closing index or -1. */
function findStringEnd(text: string, start: number, quote: string): number {
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i]
    if (char === '\\') {
      i++
      continue
    }
    if (char === quote) return i
  }
  return -1
}

const LIFETIME_RE = /^'[A-Za-z_][A-Za-z0-9_]*/

/**
 * Rule 4 — "blank boundaries must be token-balanced". A blank that opens a
 * paren/bracket/quote it does not close is splitting a token pair across the
 * blank edge, which makes the answer un-guessable and the feedback wrong.
 *
 * `lang` matters for one thing only: Rust lifetimes (`'a`, `'static`) are single
 * quotes that never close. Applying that exemption to every language would make
 * `'update:modelValue'` look like a lifetime followed by a stray quote.
 */
export function checkTokenBalance(answer: string, lang = ''): BalanceResult {
  const allowLifetimes = lang === 'rust'
  const stack: string[] = []
  let i = 0

  while (i < answer.length) {
    const char = answer[i] ?? ''

    if (char === '\\') {
      i += 2
      continue
    }

    if (char === '"' || char === '`') {
      const end = findStringEnd(answer, i, char)
      if (end === -1) return { balanced: false, reason: `unterminated ${char} string literal` }
      i = end + 1
      continue
    }

    if (char === "'") {
      const lifetime = allowLifetimes ? LIFETIME_RE.exec(answer.slice(i)) : null
      if (lifetime && answer[i + lifetime[0].length] !== "'") {
        // Rust lifetime / label, not a character literal.
        i += lifetime[0].length
        continue
      }
      const end = findStringEnd(answer, i, "'")
      if (end === -1) return { balanced: false, reason: "unterminated ' string literal" }
      i = end + 1
      continue
    }

    if (PAIRS[char]) {
      stack.push(char)
      i++
      continue
    }

    if (CLOSERS.has(char)) {
      const open = stack.pop()
      if (!open || PAIRS[open] !== char) {
        return { balanced: false, reason: `unmatched closing ${char}` }
      }
      i++
      continue
    }

    i++
  }

  const dangling = stack.at(-1)
  if (dangling) return { balanced: false, reason: `unclosed ${dangling}` }
  return { balanced: true }
}

/**
 * Rebuilds the solution from the starter code by dropping each canonical answer
 * back into its placeholder span. This is exactly what the editor submits when a
 * student types every answer correctly, so it must reproduce the stored solution
 * byte for byte.
 */
export interface StarterSpan {
  readonly from: number
  readonly to: number
  readonly solution: string
}

export function renderStarterWithAnswers(
  starterCode: string,
  spans: readonly StarterSpan[]
): string {
  const ordered = spans.toSorted((a, b) => a.from - b.from)
  let out = ''
  let cursor = 0
  for (const span of ordered) {
    if (span.from < cursor) continue
    out += starterCode.slice(cursor, span.from) + span.solution
    cursor = span.to
  }
  return out + starterCode.slice(cursor)
}

/** 1-based index of the first line where the two texts diverge, or null. */
export function firstDivergentLine(a: string, b: string): number | null {
  if (a === b) return null
  const left = a.split('\n')
  const right = b.split('\n')
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i++) {
    if (left[i] !== right[i]) return i + 1
  }
  return null
}

export { BLANK_END_MARKER, BLANK_START_MARKER }
