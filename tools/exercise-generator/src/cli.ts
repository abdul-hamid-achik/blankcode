#!/usr/bin/env node
import { generateExercise } from './index.js'

const args = process.argv.slice(2)

function printUsage() {
  console.log(`
Usage: exercise-generator <track> <concept> <difficulty> [topic]

Arguments:
  track       Track slug (typescript, vue, react, etc.)
  concept     Concept slug (async-patterns, composition-api, etc.)
  difficulty  beginner | intermediate | advanced | expert
  topic       Optional specific topic to focus on

Example:
  exercise-generator typescript async-patterns intermediate "error handling"
`)
}

async function main() {
  if (args.length < 3) {
    printUsage()
    process.exit(1)
  }

  const [track, concept, difficulty, topic] = args

  if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty!)) {
    console.error('Invalid difficulty. Must be: beginner, intermediate, advanced, or expert')
    process.exit(1)
  }

  console.log(`\nGenerating exercise:`)
  console.log(`  Track: ${track}`)
  console.log(`  Concept: ${concept}`)
  console.log(`  Difficulty: ${difficulty}`)
  if (topic) {
    console.log(`  Topic: ${topic}`)
  }

  try {
    const result = await generateExercise({
      track: track!,
      concept: concept!,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced' | 'expert',
      ...(topic !== undefined && { topic }),
    })

    console.log('\n--- Generated Exercise ---\n')
    console.log(result)
  } catch (error) {
    console.error('Generation failed:', error)
    process.exit(1)
  }
}

main()
