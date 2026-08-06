import { DIFFICULTIES, EXERCISE_TYPES } from '@blankcode/shared'
import { isMap, isScalar, isSeq, type Node, parseDocument, type ParsedNode } from 'yaml'

/**
 * `parseExercise` reports frontmatter failures as one opaque Effect schema
 * message ("(Struct (Encoded side) <-> Struct (Type side))") with no location.
 * That is useless to a content author, so when the importer would skip a file we
 * re-parse the YAML ourselves purely to say *which line* is wrong and why.
 *
 * The most common real failure is authoring rule 10: an unquoted `: ` inside a
 * hint turns the list item into a nested mapping, so `hints` decodes as an array
 * of objects instead of strings and the whole file is skipped.
 */
export interface FrontmatterDiagnostic {
  /** Offset relative to the YAML text (not the file). */
  readonly offset: number
  readonly message: string
}

const REQUIRED_STRING_KEYS = ['slug', 'title', 'description'] as const
const SLUG_RE = /^[a-z0-9-]+$/
const COLON_HINT =
  'A value containing `: ` must be quoted, otherwise YAML reads it as a nested mapping (authoring rule 10).'

function offsetOf(node: Node | ParsedNode | null | undefined): number {
  return node?.range?.[0] ?? 0
}

function scalarString(node: unknown): string | null {
  if (!isScalar(node)) return null
  return typeof node.value === 'string' ? node.value : null
}

export function diagnoseFrontmatter(raw: string): FrontmatterDiagnostic[] {
  const diagnostics: FrontmatterDiagnostic[] = []

  let doc: ReturnType<typeof parseDocument>
  try {
    doc = parseDocument(raw)
  } catch (error) {
    return [
      {
        offset: 0,
        message: `YAML could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ]
  }

  for (const error of doc.errors) {
    const hint = /implicit key|multiline key|nested mapping|block mapping/i.test(error.message)
      ? ` ${COLON_HINT}`
      : ''
    diagnostics.push({
      offset: error.pos[0],
      message: `YAML is invalid: ${error.message}.${hint}`,
    })
  }
  if (diagnostics.length > 0) return diagnostics

  const root = doc.contents
  if (!isMap(root)) {
    return [{ offset: 0, message: 'Frontmatter is not a YAML mapping.' }]
  }

  const entryFor = (key: string) =>
    root.items.find((item) => isScalar(item.key) && item.key.value === key)

  for (const key of REQUIRED_STRING_KEYS) {
    const entry = entryFor(key)
    if (!entry) {
      diagnostics.push({ offset: 0, message: `Required key \`${key}\` is missing.` })
      continue
    }
    const value = scalarString(entry.value)
    if (value === null || value.length === 0) {
      diagnostics.push({
        offset: offsetOf(entry.key as ParsedNode),
        message: `\`${key}\` must be a non-empty string.`,
      })
      continue
    }
    if (key === 'slug' && !SLUG_RE.test(value)) {
      diagnostics.push({
        offset: offsetOf(entry.value as ParsedNode),
        message: `\`slug\` must match /^[a-z0-9-]+$/ (got "${value}").`,
      })
    }
    if (key === 'title' && value.length > 200) {
      diagnostics.push({
        offset: offsetOf(entry.value as ParsedNode),
        message: `\`title\` is ${value.length} characters; the schema caps it at 200.`,
      })
    }
    if (key === 'description' && value.length > 5000) {
      diagnostics.push({
        offset: offsetOf(entry.value as ParsedNode),
        message: `\`description\` is ${value.length} characters; the schema caps it at 5000.`,
      })
    }
  }

  const difficulty = entryFor('difficulty')
  if (!difficulty) {
    diagnostics.push({ offset: 0, message: 'Required key `difficulty` is missing.' })
  } else {
    const value = scalarString(difficulty.value)
    if (value === null || !DIFFICULTIES.includes(value as (typeof DIFFICULTIES)[number])) {
      diagnostics.push({
        offset: offsetOf(difficulty.value as ParsedNode),
        message: `\`difficulty\` must be one of ${DIFFICULTIES.join(' | ')}.`,
      })
    }
  }

  const type = entryFor('type')
  if (type) {
    const value = scalarString(type.value)
    if (value === null || !EXERCISE_TYPES.includes(value as (typeof EXERCISE_TYPES)[number])) {
      diagnostics.push({
        offset: offsetOf(type.value as ParsedNode),
        message: `\`type\` must be one of ${EXERCISE_TYPES.join(' | ')}.`,
      })
    }
  }

  for (const key of ['hints', 'tags'] as const) {
    const entry = entryFor(key)
    if (!entry) continue
    if (!isSeq(entry.value)) {
      diagnostics.push({
        offset: offsetOf(entry.key as ParsedNode),
        message: `\`${key}\` must be a list of strings.`,
      })
      continue
    }
    for (const item of entry.value.items) {
      if (scalarString(item) !== null) continue
      const nested = isMap(item)
      diagnostics.push({
        offset: offsetOf(item as ParsedNode),
        message: nested
          ? `\`${key}\` entry parsed as a YAML mapping, not a string. ${COLON_HINT}`
          : `\`${key}\` entries must be strings.`,
      })
    }
  }

  return diagnostics
}
