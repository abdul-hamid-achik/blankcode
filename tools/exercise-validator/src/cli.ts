#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'
import { countBySeverity, type Finding } from './finding.js'
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

/**
 * Every `_track.yaml` and `_concept.yaml` has to parse.
 *
 * This rule exists because two of them did not, and nothing said so. A concept
 * description containing a colon-space — "It is not: a tool" — is a nested
 * mapping to YAML, and the importer died on it halfway through the corpus,
 * leaving the database with whatever it had managed to write. The validator
 * reported zero findings the whole time, because it only ever read the exercise
 * markdown.
 *
 * Fatal: a track or concept that does not parse takes everything under it with
 * it, which is the worst blast radius in the corpus.
 */
async function checkMetadataYaml(
  contentDir: string
): Promise<{ findings: Finding[]; fileCount: number }> {
  const matches = await glob(['tracks/*/_track.yaml', 'tracks/*/*/_concept.yaml'], {
    cwd: contentDir,
    nodir: true,
  })
  const repoRoot = resolve(contentDir, '..')
  const findings: Finding[] = []

  for (const match of matches.toSorted()) {
    const absolute = join(contentDir, match)
    const file = relative(repoRoot, absolute).split(sep).join('/')
    try {
      const parsed = parseYaml(await readFile(absolute, 'utf-8'))
      if (parsed === null || typeof parsed !== 'object') {
        findings.push({
          file,
          line: 1,
          column: 1,
          severity: 'fatal',
          rule: 'metadata-yaml-not-a-mapping',
          message:
            'File does not parse to a mapping of keys, so the importer reads nothing from it.',
        })
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
      findings.push({
        file,
        line: 1,
        column: 1,
        severity: 'fatal',
        rule: 'metadata-yaml-unparseable',
        message: `YAML does not parse: ${detail}. A colon followed by a space inside an unquoted value is the usual cause — quote the value.`,
      })
    }
  }

  return { findings, fileCount: matches.length }
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

  const corpus = validateCorpus(sources)
  const metadata = await checkMetadataYaml(options.contentDir)
  const findings = [...metadata.findings, ...corpus.findings]
  const fileCount = corpus.fileCount + metadata.fileCount
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
