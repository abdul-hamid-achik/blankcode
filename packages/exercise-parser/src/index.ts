import type {
  BlankRegion,
  BlankRegionInStarter,
  ExerciseFrontmatter,
  ParsedExercise,
} from '@blankcode/shared'
import { exerciseFrontmatterSchema } from '@blankcode/shared'
import { Either, Schema } from 'effect'
import matter from 'gray-matter'
import {
  AGENT_SEED_KINDS,
  type AgentBeat,
  type AgentScript,
  type AgentSeedKind,
  type ContextSourceDefinition,
} from '@blankcode/shared/types'
import { parse as parseYaml } from 'yaml'

const BLANK_START_MARKER = '___blank_start___'
const BLANK_END_MARKER = '___blank_end___'

export interface ParseOptions {
  validateFrontmatter?: boolean
  generateIds?: boolean
}

export interface ParseResult {
  success: true
  exercise: ParsedExercise
}

export interface ParseError {
  success: false
  errors: string[]
}

export type ParseExerciseResult = ParseResult | ParseError

export function parseExercise(markdown: string, options: ParseOptions = {}): ParseExerciseResult {
  const { validateFrontmatter = true, generateIds = true } = options

  try {
    const { data, content } = matter(markdown)

    let frontmatter: ExerciseFrontmatter
    if (validateFrontmatter) {
      const result = Schema.decodeUnknownEither(exerciseFrontmatterSchema)(data)
      if (Either.isLeft(result)) {
        return {
          success: false,
          errors: [result.left.message],
        }
      }
      frontmatter = result.right as ExerciseFrontmatter
    } else {
      frontmatter = data as ExerciseFrontmatter
    }

    const codeBlockMatch = content.match(/```[\w]*\n([\s\S]*?)```/)
    if (!codeBlockMatch) {
      return {
        success: false,
        errors: ['No code block found in exercise content'],
      }
    }

    const firstBlock = codeBlockMatch[1]?.trim() ?? ''

    // Determine exercise type based on frontmatter or presence of blank markers
    const exerciseType =
      frontmatter.type ?? (firstBlock.includes(BLANK_START_MARKER) ? 'blank' : 'challenge')

    /*
     * A blank exercise's first code block is the annotated solution, and the
     * starter is derived from it by blanking regions out.
     *
     * A challenge's first code block is the opposite: it is the empty stub the
     * learner starts from. Its reference solution lives in a `## Solution`
     * section, which is stripped from what the learner sees. Without that
     * section a challenge's "solution" was the stub itself — which is why no
     * challenge could ever be verified as solvable.
     */
    // A challenge starts from a stub, a review starts from code that already
    // looks finished and is wrong, and the session forms (turn, context) start
    // from whatever their brief hands over. Either way the first block is what
    // the learner opens and the reference lives in `## Solution`.
    const startsFromFirstBlock = exerciseType !== 'blank'

    const solutionCode = startsFromFirstBlock
      ? (extractSectionCode(content, 'Solution') ?? '')
      : firstBlock

    const blanks = startsFromFirstBlock ? [] : extractBlanks(solutionCode, generateIds)
    const { starterCode, blanksInStarter } = startsFromFirstBlock
      ? { starterCode: firstBlock, blanksInStarter: [] }
      : generateStarterCode(solutionCode, blanks)

    const agentScript = extractAgentScript(content)
    if (exerciseType === 'agent' && !agentScript) {
      return {
        success: false,
        errors: ['Agent exercise must have a ## Script section with at least one beat'],
      }
    }

    return {
      success: true,
      exercise: {
        frontmatter,
        content: content.trim(),
        blanks,
        blanksInStarter,
        starterCode,
        solutionCode,
        type: exerciseType,
        contextSources: extractContextSources(content),
        agentScript,
      },
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown parsing error'],
    }
  }
}

export function extractBlanks(code: string, generateIds = true): BlankRegion[] {
  const blanks: BlankRegion[] = []
  const lines = code.split('\n')
  let blankCounter = 0

  let inBlank = false
  let currentBlank: (Partial<BlankRegion> & Pick<BlankRegion, 'startLine' | 'startColumn'>) | null =
    null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? ''
    let columnOffset = 0

    while (columnOffset < line.length) {
      const remainingLine = line.slice(columnOffset)

      if (!inBlank) {
        const startIndex = remainingLine.indexOf(BLANK_START_MARKER)
        if (startIndex !== -1) {
          inBlank = true
          blankCounter++
          currentBlank = {
            id: generateIds ? `blank-${blankCounter}` : '',
            startLine: lineIndex,
            startColumn: columnOffset + startIndex,
            placeholder: '',
            solution: '',
          }
          columnOffset += startIndex + BLANK_START_MARKER.length
          continue
        }
      } else {
        const endIndex = remainingLine.indexOf(BLANK_END_MARKER)
        if (endIndex !== -1) {
          if (currentBlank) {
            currentBlank.endLine = lineIndex
            currentBlank.endColumn = columnOffset + endIndex + BLANK_END_MARKER.length

            const solutionText = extractSolutionText(
              code,
              currentBlank.startLine,
              currentBlank.startColumn + BLANK_START_MARKER.length,
              lineIndex,
              columnOffset + endIndex
            )

            currentBlank.solution = solutionText.trim()
            currentBlank.placeholder = generatePlaceholder(currentBlank.solution)

            blanks.push(currentBlank as BlankRegion)
          }

          inBlank = false
          currentBlank = null
          columnOffset += endIndex + BLANK_END_MARKER.length
          continue
        }
      }

      break
    }
  }

  if (inBlank) {
    throw new Error('Unclosed blank region detected')
  }

  return blanks
}

/**
 * Returns the code inside the first fenced block under a `## <heading>`
 * section, or undefined when the section is absent.
 *
 * Used for a challenge's reference solution, which must not reach the learner —
 * `redactExercise` strips `solutionCode` from every response, and the importer
 * never puts this section into the rendered content.
 */
export function extractSectionCode(markdown: string, heading: string): string | undefined {
  const pattern = new RegExp(`^##\\s+${heading}\\s*$`, 'im')
  const match = pattern.exec(markdown)
  if (!match) return undefined

  const after = markdown.slice(match.index + match[0].length)
  // Stop at the next `##` so a later section's code cannot be picked up.
  const nextHeading = after.search(/^##\s+/m)
  const section = nextHeading === -1 ? after : after.slice(0, nextHeading)

  const code = /```[\w]*\n([\s\S]*?)```/.exec(section)
  return code?.[1]?.trim()
}

function extractSolutionText(
  code: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number
): string {
  const lines = code.split('\n')

  if (startLine === endLine) {
    return lines[startLine]?.slice(startColumn, endColumn) ?? ''
  }

  const result: string[] = []
  for (let i = startLine; i <= endLine; i++) {
    const line = lines[i] ?? ''
    if (i === startLine) {
      result.push(line.slice(startColumn))
    } else if (i === endLine) {
      result.push(line.slice(0, endColumn))
    } else {
      result.push(line)
    }
  }

  return result.join('\n')
}

function generatePlaceholder(solution: string): string {
  const trimmed = solution.trim()
  if (trimmed.length <= 3) {
    return '___'
  }
  if (trimmed.length <= 10) {
    return '_'.repeat(trimmed.length)
  }
  return `${'_'.repeat(10)}...`
}

export interface StarterCodeResult {
  starterCode: string
  blanksInStarter: BlankRegionInStarter[]
}

export function generateStarterCode(code: string, blanks: BlankRegion[]): StarterCodeResult {
  let result = code
  const sortedBlanks = [...blanks].sort((a, b) => {
    if (a.startLine !== b.startLine) {
      return b.startLine - a.startLine
    }
    return b.startColumn - a.startColumn
  })

  for (const blank of sortedBlanks) {
    const lines = result.split('\n')
    const startLineContent = lines[blank.startLine] ?? ''
    const endLineContent = lines[blank.endLine] ?? ''

    if (blank.startLine === blank.endLine) {
      const newLine =
        startLineContent.slice(0, blank.startColumn) +
        blank.placeholder +
        endLineContent.slice(blank.endColumn)
      lines[blank.startLine] = newLine
    } else {
      const newStartLine = startLineContent.slice(0, blank.startColumn) + blank.placeholder
      lines[blank.startLine] = newStartLine

      for (let i = blank.startLine + 1; i <= blank.endLine; i++) {
        if (i === blank.endLine) {
          lines[i] = endLineContent.slice(blank.endColumn)
        } else {
          lines[i] = ''
        }
      }
    }

    result = lines
      .filter((line, index) => {
        if (index > blank.startLine && index <= blank.endLine) {
          return line !== ''
        }
        return true
      })
      .join('\n')
  }

  // Now compute character offsets for each blank placeholder in the final starter code.
  // We search for each placeholder by scanning forward through the starter code,
  // matching the fixed text segments between blanks.
  const blanksInStarter = computeBlanksInStarter(result, blanks)

  return { starterCode: result, blanksInStarter }
}

function computeBlanksInStarter(
  starterCode: string,
  blanks: BlankRegion[]
): BlankRegionInStarter[] {
  // Sort blanks by their original order (top-to-bottom, left-to-right)
  const orderedBlanks = [...blanks].sort((a, b) => {
    if (a.startLine !== b.startLine) return a.startLine - b.startLine
    return a.startColumn - b.startColumn
  })

  const result: BlankRegionInStarter[] = []
  let searchFrom = 0

  for (const blank of orderedBlanks) {
    const idx = starterCode.indexOf(blank.placeholder, searchFrom)
    if (idx === -1) continue

    result.push({
      id: blank.id,
      from: idx,
      to: idx + blank.placeholder.length,
      placeholder: blank.placeholder,
      solution: blank.solution,
    })

    searchFrom = idx + blank.placeholder.length
  }

  return result
}

export function validateExercise(exercise: ParsedExercise): string[] {
  const errors: string[] = []

  if (!exercise.frontmatter.slug) {
    errors.push('Exercise slug is required')
  }

  if (!exercise.frontmatter.title) {
    errors.push('Exercise title is required')
  }

  // Only blank exercises require blanks
  if (exercise.type === 'blank' && exercise.blanks.length === 0) {
    errors.push('Blank exercise must have at least one blank region')
  }

  if (!exercise.solutionCode) {
    errors.push('Exercise must have solution code')
  }

  if (!exercise.starterCode) {
    errors.push('Exercise must have starter code')
  }

  if (exercise.type === 'agent' && !exercise.agentScript) {
    errors.push('Agent exercise must have a ## Script section')
  }

  if (exercise.type === 'blank') {
    for (const blank of exercise.blanks) {
      if (!blank.solution) {
        errors.push(`Blank ${blank.id} has empty solution`)
      }
    }
  }

  return errors
}

export function stripBlankMarkers(code: string): string {
  return code
    .replace(new RegExp(BLANK_START_MARKER, 'g'), '')
    .replace(new RegExp(BLANK_END_MARKER, 'g'), '')
}

export { BLANK_END_MARKER, BLANK_START_MARKER }

/**
 * The `## Context` section of a context-selection exercise.
 *
 * YAML rather than fenced code per source, because a source has a price and a
 * label as well as contents, and encoding three fields in a code fence means
 * inventing a convention that only this file understands.
 *
 * Returns null when the section is absent, which is every other exercise.
 */
export function extractContextSources(markdown: string): ContextSourceDefinition | null {
  const yaml = extractSectionCode(markdown, 'Context')
  if (!yaml) return null

  const parsed = parseYaml(yaml) as Partial<ContextSourceDefinition> | null
  if (!parsed?.sources || !Array.isArray(parsed.sources)) return null

  return {
    sources: parsed.sources,
    required: parsed.required ?? [],
    accept: parsed.accept ?? '.',
  }
}

function asBeat(raw: unknown): AgentBeat | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as { say?: unknown; code?: unknown; run?: unknown }
  if (typeof row.say !== 'string' || row.say.trim().length === 0) return null
  return {
    say: row.say,
    code: typeof row.code === 'string' ? row.code : null,
    run: row.run === true,
  }
}

/**
 * The `## Script` section of an agent-supervision exercise.
 *
 * YAML in a fenced block, same shape as Context: the session is authored
 * content and has to survive import as a snapshot. Returns null when the
 * section is absent or does not describe at least one beat.
 */
export function extractAgentScript(markdown: string): AgentScript | null {
  const yaml = extractSectionCode(markdown, 'Script')
  if (!yaml) return null

  const parsed = parseYaml(yaml) as {
    beats?: unknown
    seeds?: unknown
    rubric?: unknown
  } | null
  if (!parsed || !Array.isArray(parsed.beats)) return null

  const beats: AgentBeat[] = []
  for (const raw of parsed.beats) {
    const beat = asBeat(raw)
    if (!beat) return null
    beats.push(beat)
  }
  if (beats.length === 0) return null

  const kinds = new Set<string>(AGENT_SEED_KINDS)
  const seeds: AgentScript['seeds'][number][] = []
  for (const raw of Array.isArray(parsed.seeds) ? parsed.seeds : []) {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as {
      at?: unknown
      kind?: unknown
      window?: unknown
      weight?: unknown
      truth?: unknown
      caught?: unknown
      missed?: unknown
    }
    if (typeof row.at !== 'number' || !Number.isInteger(row.at) || row.at < 0) return null
    if (typeof row.kind !== 'string' || !kinds.has(row.kind)) return null
    if (typeof row.window !== 'number' || row.window < 1) return null
    if (typeof row.weight !== 'number' || row.weight < 1) return null
    if (typeof row.truth !== 'string' || row.truth.trim().length === 0) return null
    const caught = Array.isArray(row.caught) ? row.caught.map(asBeat) : []
    const missed = Array.isArray(row.missed) ? row.missed.map(asBeat) : []
    if (caught.some((b) => b === null) || missed.some((b) => b === null)) return null
    seeds.push({
      at: row.at,
      kind: row.kind as AgentSeedKind,
      window: row.window,
      weight: row.weight,
      truth: row.truth,
      caught: caught as AgentBeat[],
      missed: missed as AgentBeat[],
    })
  }

  const rubric: AgentScript['rubric'][number][] = []
  for (const raw of Array.isArray(parsed.rubric) ? parsed.rubric : []) {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as { id?: unknown; weight?: unknown }
    if (typeof row.id !== 'string' || row.id.length === 0) return null
    if (typeof row.weight !== 'number' || row.weight < 1) return null
    rubric.push({ id: row.id, weight: row.weight })
  }

  return { beats, seeds, rubric }
}
