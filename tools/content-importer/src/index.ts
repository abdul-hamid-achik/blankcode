import { readFile } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'
import { createDatabaseFromEnv, tracks, concepts, exercises } from '@blankcode/db'
import { parseExercise, stripBlankMarkers } from '@blankcode/exercise-parser'
import { eq } from 'drizzle-orm'

export interface ImportResult {
  tracks: number
  concepts: number
  exercises: number
}

export async function importContent(contentDir: string): Promise<ImportResult> {
  const db = createDatabaseFromEnv()
  const result: ImportResult = { tracks: 0, concepts: 0, exercises: 0 }

  const trackFiles = await glob('*/_track.yaml', { cwd: join(contentDir, 'tracks') })

  for (const trackFile of trackFiles) {
    const trackPath = join(contentDir, 'tracks', trackFile)
    const trackDir = dirname(trackPath)
    const trackData = parseYaml(await readFile(trackPath, 'utf-8'))

    const [track] = await db
      .insert(tracks)
      .values({
        slug: trackData.slug,
        name: trackData.name,
        description: trackData.description,
        order: trackData.order ?? 0,
        isPublished: trackData.isPublished ?? false,
      })
      .onConflictDoUpdate({
        target: tracks.slug,
        set: {
          name: trackData.name,
          description: trackData.description,
          order: trackData.order ?? 0,
          isPublished: trackData.isPublished ?? false,
          updatedAt: new Date(),
        },
      })
      .returning()

    result.tracks++
    console.log(`Imported track: ${track!.name}`)

    const conceptFiles = await glob('*/_concept.yaml', { cwd: trackDir })

    for (const conceptFile of conceptFiles) {
      const conceptPath = join(trackDir, conceptFile)
      const conceptDir = dirname(conceptPath)
      const conceptData = parseYaml(await readFile(conceptPath, 'utf-8'))

      const [concept] = await db
        .insert(concepts)
        .values({
          trackId: track!.id,
          slug: conceptData.slug,
          name: conceptData.name,
          description: conceptData.description,
          order: conceptData.order ?? 0,
          isPublished: conceptData.isPublished ?? false,
        })
        .onConflictDoUpdate({
          target: [concepts.trackId, concepts.slug],
          set: {
            name: conceptData.name,
            description: conceptData.description,
            order: conceptData.order ?? 0,
            isPublished: conceptData.isPublished ?? false,
            updatedAt: new Date(),
          },
        })
        .returning()

      result.concepts++
      console.log(`  Imported concept: ${concept!.name}`)

      const exerciseFiles = await glob('*.md', { cwd: conceptDir })

      for (const exerciseFile of exerciseFiles) {
        const exercisePath = join(conceptDir, exerciseFile)
        const markdown = await readFile(exercisePath, 'utf-8')

        const parseResult = parseExercise(markdown)
        if (!parseResult.success) {
          console.error(`    Failed to parse ${exerciseFile}:`, parseResult.errors)
          continue
        }

        const { frontmatter, starterCode, solutionCode } = parseResult.exercise

        const codeBlockMatch = markdown.match(/## Tests\s*```[\w]*\n([\s\S]*?)```/)
        const testCode = codeBlockMatch?.[1]?.trim() ?? ''

        await db
          .insert(exercises)
          .values({
            conceptId: concept!.id,
            slug: frontmatter.slug,
            title: frontmatter.title,
            description: frontmatter.description,
            difficulty: frontmatter.difficulty,
            starterCode,
            solutionCode: stripBlankMarkers(solutionCode),
            testCode,
            hints: frontmatter.hints ?? [],
            order: 0,
            isPublished: true,
          })
          .onConflictDoUpdate({
            target: [exercises.conceptId, exercises.slug],
            set: {
              title: frontmatter.title,
              description: frontmatter.description,
              difficulty: frontmatter.difficulty,
              starterCode,
              solutionCode: stripBlankMarkers(solutionCode),
              testCode,
              hints: frontmatter.hints ?? [],
              updatedAt: new Date(),
            },
          })

        result.exercises++
        console.log(`    Imported exercise: ${frontmatter.title}`)
      }
    }
  }

  return result
}
