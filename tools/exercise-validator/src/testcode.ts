/**
 * Heuristics over the `## Tests` block.
 *
 * Rule 7 ("tests must exercise the student's code, never re-implement it") is
 * not statically decidable, but its cheapest failure mode is: a test function
 * that contains no assertion at all. `go-con-001`'s `TestProgramRuns` just calls
 * `main()` and passes for any input, so the check is done per test function
 * rather than per file — a file-level scan would be masked by its siblings.
 */

export interface TestSegment {
  readonly name: string
  /** Offset of the segment start within the test code. */
  readonly offset: number
  readonly body: string
}

const SEGMENTERS: Record<string, RegExp> = {
  go: /^func[ \t]+(Test\w+)[ \t]*\(/gm,
  python: /^[ \t]*def[ \t]+(test_\w+)[ \t]*\(/gm,
  rust: /#\[(?:tokio::)?test\][\s\S]{0,80}?fn[ \t]+(\w+)[ \t]*\(/g,
  typescript: /\b(?:it|test)[ \t]*\(\s*['"`]([^'"`]*)/g,
}

const LANG_ALIASES: Record<string, string> = {
  golang: 'go',
  py: 'python',
  py3: 'python',
  rs: 'rust',
  ts: 'typescript',
  tsx: 'typescript',
  js: 'typescript',
  jsx: 'typescript',
  javascript: 'typescript',
  vue: 'typescript',
  react: 'typescript',
}

export function normalizeLang(lang: string): string {
  const lower = lang.toLowerCase()
  return LANG_ALIASES[lower] ?? lower
}

const ASSERTIONS: Record<string, RegExp> = {
  // `var _ Iface = Concrete{}` is Go's compile-time interface assertion — it is a
  // real check even though nothing calls t.Error.
  go: /\bt\.(?:Error|Errorf|Fatal|Fatalf|Fail|FailNow|Skip)\b|\bvar\s+_\s+[\w.[\]]+\s*=/,
  python: /(?:^|[^\w.])assert(?:\s|\()|self\.assert|pytest\.raises/,
  rust: /\bassert(?:_eq|_ne)?!|\bpanic!|\bunreachable!/,
  typescript: /\bexpect\s*\(|\bassert\b/,
}

/**
 * Splits test code into per-test-function segments. Falls back to a single
 * whole-file segment when the language is unknown or nothing matched, so the
 * caller never silently skips a file.
 */
/**
 * Blanks out the contents of string and template literals, keeping the source
 * the same length so every offset still points where it did.
 *
 * A test declaration inside a string is a *fixture*, not a test — an exercise
 * about linting test files contains them by definition, and reporting those
 * gave eight findings on a file with nothing wrong with it. A rule that cries
 * wolf is a rule people stop reading, which costs more than the rule was worth.
 */
export function maskStringContents(code: string): string {
  const out = code.split('')
  let quote: string | null = null
  let escaped = false

  for (let i = 0; i < code.length; i++) {
    const char = code[i]!

    if (quote) {
      if (escaped) {
        escaped = false
        out[i] = ' '
        continue
      }
      if (char === '\\') {
        escaped = true
        out[i] = ' '
        continue
      }
      if (char === quote) {
        quote = null
        continue
      }
      // Newlines are preserved so line numbers do not shift.
      if (char !== '\n') out[i] = ' '
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
    }
  }

  return out.join('')
}

export function segmentTests(lang: string, code: string): TestSegment[] {
  const normalized = normalizeLang(lang)
  const pattern = SEGMENTERS[normalized]
  if (!pattern) return [{ name: '', offset: 0, body: code }]

  const re = new RegExp(pattern.source, pattern.flags)
  const starts: Array<{ name: string; offset: number }> = []
  // Scanned against the masked source so a fixture inside a string cannot be
  // mistaken for a test; the offsets still index into the real code.
  const scannable = maskStringContents(code)
  let match = re.exec(scannable)
  while (match) {
    // The name lives inside the literal the mask blanked, so it is read back
    // from the original source at the same offset.
    const nameMatch = new RegExp(pattern.source, pattern.flags.replace('g', '')).exec(
      code.slice(match.index)
    )
    starts.push({ name: nameMatch?.[1] ?? '', offset: match.index })
    match = re.exec(scannable)
  }
  if (starts.length === 0) return [{ name: '', offset: 0, body: code }]

  return starts.map((start, i) => ({
    name: start.name,
    offset: start.offset,
    body: code.slice(start.offset, starts[i + 1]?.offset ?? code.length),
  }))
}

export function hasAssertion(lang: string, code: string): boolean {
  const pattern = ASSERTIONS[normalizeLang(lang)]
  if (!pattern) return true
  return pattern.test(code)
}

/** True when the language has an assertion pattern we know how to look for. */
export function knowsAssertions(lang: string): boolean {
  return ASSERTIONS[normalizeLang(lang)] !== undefined
}
