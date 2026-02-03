#!/usr/bin/env node
import 'dotenv-mono/load'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateExercise, generateTrackScaffold } from './index.js'

const args = process.argv.slice(2)

function getContentDir(): string {
  // Walk up from this file to find the monorepo root (where turbo.json is)
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'turbo.json'))) {
      return join(dir, 'content', 'tracks')
    }
    dir = dirname(dir)
  }
  return join(process.cwd(), 'content', 'tracks')
}

function printUsage() {
  console.log(`
Usage:
  exercise-generator <track> <concept> <difficulty> [topic]
  exercise-generator --init <track> [--name "Track Name"]

Commands:
  <track> <concept> <difficulty> [topic]
    Generate an exercise and save it to the content folder

  --init <track> [--name "Track Name"]
    Initialize a new track with scaffold structure

Arguments:
  track       Track slug (typescript, vue, react, etc.)
  concept     Concept slug (async-patterns, composition-api, etc.)
  difficulty  beginner | intermediate | advanced | expert
  topic       Optional specific topic to focus on

Options:
  --init      Initialize a new track
  --name      Human-readable track name (used with --init)
  --dry-run   Print output without saving to file

Examples:
  exercise-generator typescript generics advanced "conditional types"
  exercise-generator --init react --name "React"
  exercise-generator vue composition-api beginner --dry-run
`)
}

function getNextExerciseNumber(conceptDir: string, prefix: string): string {
  if (!existsSync(conceptDir)) {
    return '001'
  }

  const files = readdirSync(conceptDir).filter(f => f.endsWith('.md') && f.startsWith(prefix))
  const numbers = files.map(f => {
    const match = f.match(/-(\d{3})\.md$/)
    return match?.[1] ? Number.parseInt(match[1], 10) : 0
  })

  const maxNum = Math.max(0, ...numbers)
  return String(maxNum + 1).padStart(3, '0')
}

async function initTrack(trackSlug: string, trackName?: string) {
  const contentDir = getContentDir()
  const trackDir = join(contentDir, trackSlug)

  if (existsSync(trackDir)) {
    console.error(`Track directory already exists: ${trackDir}`)
    process.exit(1)
  }

  console.log(`\nInitializing track: ${trackSlug}`)

  try {
    const scaffold = await generateTrackScaffold(trackSlug, trackName || trackSlug)

    // Create track directory and _track.yaml
    mkdirSync(trackDir, { recursive: true })
    writeFileSync(join(trackDir, '_track.yaml'), scaffold.trackYaml)
    console.log(`  Created: ${trackSlug}/_track.yaml`)

    // Create concept directories with _concept.yaml
    for (const concept of scaffold.concepts) {
      const conceptDir = join(trackDir, concept.slug)
      mkdirSync(conceptDir, { recursive: true })
      writeFileSync(join(conceptDir, '_concept.yaml'), concept.yaml)
      console.log(`  Created: ${trackSlug}/${concept.slug}/_concept.yaml`)
    }

    console.log(`\nTrack initialized successfully!`)
    console.log(`\nNext steps:`)
    console.log(`  1. Review and edit the YAML files in content/tracks/${trackSlug}/`)
    console.log(`  2. Generate exercises: bun run content:generate ${trackSlug} <concept> <difficulty>`)
    console.log(`  3. Import to database: bun run content:import`)
  } catch (error) {
    console.error('Track initialization failed:', error)
    process.exit(1)
  }
}

async function generateAndSave(
  track: string,
  concept: string,
  difficulty: string,
  topic?: string,
  dryRun = false
) {
  console.log(`\nGenerating exercise:`)
  console.log(`  Track: ${track}`)
  console.log(`  Concept: ${concept}`)
  console.log(`  Difficulty: ${difficulty}`)
  if (topic) {
    console.log(`  Topic: ${topic}`)
  }

  try {
    const result = await generateExercise({
      track,
      concept,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
      ...(topic !== undefined && { topic }),
    })

    if (dryRun) {
      console.log('\n--- Generated Exercise (dry run) ---\n')
      console.log(result)
      return
    }

    // Determine file path
    const contentDir = getContentDir()
    const conceptDir = join(contentDir, track, concept)

    // Create concept directory if it doesn't exist
    if (!existsSync(conceptDir)) {
      mkdirSync(conceptDir, { recursive: true })
      // Create a basic _concept.yaml if it doesn't exist
      const conceptYamlPath = join(conceptDir, '_concept.yaml')
      if (!existsSync(conceptYamlPath)) {
        const conceptYaml = `slug: ${concept}
name: ${concept.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
description: Exercises for ${concept}.
order: 1
isPublished: true
`
        writeFileSync(conceptYamlPath, conceptYaml)
        console.log(`  Created: ${track}/${concept}/_concept.yaml`)
      }
    }

    // Generate filename with auto-increment
    const prefix = `${track.slice(0, 2)}-${concept.slice(0, 3)}`
    const num = getNextExerciseNumber(conceptDir, prefix)
    const filename = `${prefix}-${num}.md`
    const filepath = join(conceptDir, filename)

    writeFileSync(filepath, result)
    console.log(`\n  Saved: content/tracks/${track}/${concept}/${filename}`)
    console.log(`\nNext: Run 'bun run content:import' to import to database`)
  } catch (error) {
    console.error('Generation failed:', error)
    process.exit(1)
  }
}

async function main() {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  // Handle --init command
  if (args[0] === '--init') {
    const trackSlug = args[1]
    if (!trackSlug) {
      console.error('Error: --init requires a track slug')
      printUsage()
      process.exit(1)
    }

    const nameIndex = args.indexOf('--name')
    const trackName = nameIndex !== -1 ? args[nameIndex + 1] : undefined

    await initTrack(trackSlug, trackName)
    return
  }

  // Handle exercise generation
  if (args.length < 3) {
    printUsage()
    process.exit(1)
  }

  const [track, concept, difficulty, topic] = args.filter(a => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')

  if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty!)) {
    console.error('Invalid difficulty. Must be: beginner, intermediate, advanced, or expert')
    process.exit(1)
  }

  await generateAndSave(track!, concept!, difficulty!, topic, dryRun)
}

main()
