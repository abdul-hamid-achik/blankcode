#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { glob } from 'glob'
import { countBySeverity } from './finding.js'
import { formatJson, formatReport } from './report.js'
import { type ExerciseSource, validateCorpus } from './validate.js'

interface Options {
  readonly contentDir: string
  readonly json: boolean
  readonly strict: boolean
  readonly color: boolean
}

const USAGE = `exercise-validator — static checks over content/tracks/*/*/*.md

Usage: bun run content:validate [contentDir] [options]

  contentDir   defaults to the nearest ancestor directory containing content/tracks

Options:
  --json       machine-readable output
  --strict     also exit non-zero on ERROR findings (default: FATAL only)
  --no-color   disable ANSI colour
  -h, --help   show this message
`

/** Walks up from `start` until a directory containing `content/tracks` is found. */
function findContentDir(start: string): string | null {
  let current = resolve(start)
  for (;;) {
    if (existsSync(join(current, 'content', 'tracks'))) return join(current, 'content')
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function parseArgs(argv: readonly string[]): Options | null {
  const positional: string[] = []
  let json = false
  let strict = false
  let color = process.stdout.isTTY === true && !process.env['NO_COLOR']

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') return null
    else if (arg === '--json') json = true
    else if (arg === '--strict') strict = true
    else if (arg === '--no-color') color = false
    else if (arg === '--color') color = true
    else positional.push(arg)
  }

  const explicit = positional[0]
  const contentDir = explicit ? resolve(explicit) : (findContentDir(process.cwd()) ?? '')
  return { contentDir, json, strict, color }
}

async function loadSources(contentDir: string): Promise<ExerciseSource[]> {
  const matches = await glob('tracks/*/*/*.md', { cwd: contentDir, nodir: true })
  const repoRoot = resolve(contentDir, '..')

  const sources = await Promise.all(
    matches.toSorted().map(async (match) => {
      const absolute = join(contentDir, match)
      return {
        file: relative(repoRoot, absolute).split(sep).join('/'),
        text: await readFile(absolute, 'utf-8'),
      }
    })
  )
  return sources
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2))
  if (!options) {
    console.log(USAGE)
    return 0
  }

  if (!options.contentDir || !existsSync(options.contentDir)) {
    console.error(
      `Could not find a content directory (looked upwards from ${process.cwd()}). Pass one explicitly.`
    )
    return 2
  }

  const sources = await loadSources(options.contentDir)
  if (sources.length === 0) {
    console.error(`No exercise markdown found under ${options.contentDir}/tracks/*/*/*.md`)
    return 2
  }

  const { findings, fileCount } = validateCorpus(sources)
  const counts = countBySeverity(findings)

  if (options.json) {
    console.log(formatJson(findings, fileCount))
  } else {
    console.log(formatReport(findings, { fileCount, color: options.color }))
  }

  if (counts.fatal > 0) return 1
  if (options.strict && counts.error > 0) return 1
  return 0
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error('exercise-validator crashed:', error)
  process.exitCode = 2
}
