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
export function segmentTests(lang: string, code: string): TestSegment[] {
  const normalized = normalizeLang(lang)
  const pattern = SEGMENTERS[normalized]
  if (!pattern) return [{ name: '', offset: 0, body: code }]

  const re = new RegExp(pattern.source, pattern.flags)
  const starts: Array<{ name: string; offset: number }> = []
  let match = re.exec(code)
  while (match) {
    starts.push({ name: match[1] ?? '', offset: match.index })
    match = re.exec(code)
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
