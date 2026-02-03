#!/usr/bin/env node
import 'dotenv-mono/load'
import { importContent } from './index.js'

const args = process.argv.slice(2)
const contentDir = args[0] ?? '../../content'

async function main() {
  console.log(`Importing content from: ${contentDir}`)

  try {
    const result = await importContent(contentDir)
    console.log('\nImport completed:')
    console.log(`  Tracks: ${result.tracks}`)
    console.log(`  Concepts: ${result.concepts}`)
    console.log(`  Exercises: ${result.exercises}`)
  } catch (error) {
    console.error('Import failed:', error)
    process.exit(1)
  }
}

main()
