import matter from 'gray-matter'
import type { BlankRegion, ExerciseFrontmatter, ParsedExercise } from '@blankcode/shared'
import { exerciseFrontmatterSchema } from '@blankcode/shared'

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

export function parseExercise(
  markdown: string,
  options: ParseOptions = {}
): ParseExerciseResult {
  const { validateFrontmatter = true, generateIds = true } = options

  try {
    const { data, content } = matter(markdown)

    let frontmatter: ExerciseFrontmatter
    if (validateFrontmatter) {
      const result = exerciseFrontmatterSchema.safeParse(data)
      if (!result.success) {
        return {
          success: false,
          errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        }
      }
      frontmatter = result.data
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

    const solutionCode = codeBlockMatch[1]?.trim() ?? ''
    const blanks = extractBlanks(solutionCode, generateIds)
    const starterCode = generateStarterCode(solutionCode, blanks)

    return {
      success: true,
      exercise: {
        frontmatter,
        content: content.trim(),
        blanks,
        starterCode,
        solutionCode,
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
  let currentBlank: Partial<BlankRegion> | null = null

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
              currentBlank.startLine!,
              currentBlank.startColumn! + BLANK_START_MARKER.length,
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
  return '_'.repeat(10) + '...'
}

export function generateStarterCode(code: string, blanks: BlankRegion[]): string {
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
      const newStartLine =
        startLineContent.slice(0, blank.startColumn) + blank.placeholder
      lines[blank.startLine] = newStartLine

      for (let i = blank.startLine + 1; i <= blank.endLine; i++) {
        if (i === blank.endLine) {
          lines[i] = endLineContent.slice(blank.endColumn)
        } else {
          lines[i] = ''
        }
      }
    }

    result = lines.filter((line, index) => {
      if (index > blank.startLine && index <= blank.endLine) {
        return line !== ''
      }
      return true
    }).join('\n')
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

  if (exercise.blanks.length === 0) {
    errors.push('Exercise must have at least one blank region')
  }

  if (!exercise.solutionCode) {
    errors.push('Exercise must have solution code')
  }

  if (!exercise.starterCode) {
    errors.push('Exercise must have starter code')
  }

  for (const blank of exercise.blanks) {
    if (!blank.solution) {
      errors.push(`Blank ${blank.id} has empty solution`)
    }
  }

  return errors
}

export function stripBlankMarkers(code: string): string {
  return code
    .replace(new RegExp(BLANK_START_MARKER, 'g'), '')
    .replace(new RegExp(BLANK_END_MARKER, 'g'), '')
}

export { BLANK_START_MARKER, BLANK_END_MARKER }
