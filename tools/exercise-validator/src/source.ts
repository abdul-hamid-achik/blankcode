/**
 * Offset -> line/column mapping plus the structural scans (frontmatter block,
 * fenced code blocks) the rules need in order to report a `file:line`.
 *
 * The fenced-block scan deliberately mirrors `parseExercise`'s regex
 * (```` /```[\w]*\n([\s\S]*?)```/ ````) rather than implementing a "correct"
 * CommonMark fence parser: the point is to report what the importer will
 * actually store, quirks included.
 */

export interface SourceIndex {
  readonly text: string
  /** Character offset at which each line starts. */
  readonly lineStarts: readonly number[]
}

export function indexSource(text: string): SourceIndex {
  const lineStarts: number[] = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1)
  }
  return { text, lineStarts }
}

/** 1-based line number containing `offset`. */
export function lineOf(index: SourceIndex, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, index.text.length))
  let low = 0
  let high = index.lineStarts.length - 1
  while (low < high) {
    const mid = (low + high + 1) >> 1
    if ((index.lineStarts[mid] ?? 0) <= clamped) low = mid
    else high = mid - 1
  }
  return low + 1
}

/** 1-based column number of `offset`. */
export function columnOf(index: SourceIndex, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, index.text.length))
  const line = lineOf(index, clamped)
  return clamped - (index.lineStarts[line - 1] ?? 0) + 1
}

export interface FrontmatterBlock {
  /** YAML text between the `---` fences (no delimiters). */
  readonly raw: string
  /** Offset of the opening `---`. */
  readonly start: number
  /** Offset of the first character of `raw`. */
  readonly rawStart: number
  /** Offset just past the closing `---` newline; where the markdown body begins. */
  readonly bodyStart: number
}

const FRONTMATTER_RE = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function findFrontmatter(text: string): FrontmatterBlock | null {
  // gray-matter tolerates a leading BOM, so skip one before matching.
  const offset = text.charCodeAt(0) === 0xfeff ? 1 : 0
  const match = FRONTMATTER_RE.exec(text.slice(offset))
  if (!match) return null
  const raw = match[1] ?? ''
  // match[0] opens with `---` + optional spaces + newline; the YAML starts after it.
  const rawStart = offset + match[0].indexOf('\n') + 1
  return {
    raw,
    start: offset,
    rawStart,
    bodyStart: offset + match[0].length,
  }
}

export interface FencedBlock {
  /** Info string of the opening fence (`go`, `python`, ...), `''` when absent. */
  readonly lang: string
  /** Block body, exactly as written (no trim). */
  readonly body: string
  /** Offset of the opening backticks. */
  readonly fenceStart: number
  /** Offset of the first character of `body`. */
  readonly bodyStart: number
  /** Offset just past the closing backticks. */
  readonly fenceEnd: number
}

/** Same match semantics as `parseExercise`, applied from `from` onwards. */
export function findFirstFencedBlock(text: string, from = 0): FencedBlock | null {
  const re = /```([\w]*)\n([\s\S]*?)```/g
  re.lastIndex = from
  const match = re.exec(text)
  if (!match) return null
  const lang = match[1] ?? ''
  const body = match[2] ?? ''
  const fenceStart = match.index
  return {
    lang,
    body,
    fenceStart,
    // '```' + lang + '\n'
    bodyStart: fenceStart + 3 + lang.length + 1,
    fenceEnd: fenceStart + match[0].length,
  }
}

export interface MarkdownHeading {
  readonly text: string
  readonly offset: number
}

export function findHeadings(text: string, from: number, to: number): MarkdownHeading[] {
  const slice = text.slice(from, to)
  const headings: MarkdownHeading[] = []
  const re = /^[ \t]{0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/gm
  let match = re.exec(slice)
  while (match) {
    headings.push({ text: match[2] ?? '', offset: from + match.index })
    match = re.exec(slice)
  }
  return headings
}

/** Every offset at which `needle` occurs in `text`. */
export function findAllOccurrences(text: string, needle: string): number[] {
  const offsets: number[] = []
  let at = text.indexOf(needle)
  while (at !== -1) {
    offsets.push(at)
    at = text.indexOf(needle, at + needle.length)
  }
  return offsets
}
