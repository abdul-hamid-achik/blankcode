import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { concepts, createDatabaseFromEnv, exercises, learningPaths, tracks } from '@blankcode/db'
import { parseExercise, stripBlankMarkers } from '@blankcode/exercise-parser'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'

export interface ImportResult {
  tracks: number
  concepts: number
  exercises: number
  paths: number
}

type Db = ReturnType<typeof createDatabaseFromEnv>

async function importTrack(db: Db, trackPath: string) {
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
  return track
}

async function importConcept(db: Db, conceptPath: string, trackId: string) {
  const conceptData = parseYaml(await readFile(conceptPath, 'utf-8'))
  const [concept] = await db
    .insert(concepts)
    .values({
      trackId,
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
  return concept
}

async function importExercise(db: Db, exercisePath: string, conceptId: string): Promise<boolean> {
  const markdown = await readFile(exercisePath, 'utf-8')
  const parseResult = parseExercise(markdown)
  if (!parseResult.success) {
    console.error(`    Failed to parse ${basename(exercisePath)}:`, parseResult.errors)
    return false
  }

  const { frontmatter, starterCode, solutionCode, blanksInStarter, type } = parseResult.exercise
  const codeBlockMatch = markdown.match(/## Tests\s*```[\w]*\n([\s\S]*?)```/)
  const testCode = codeBlockMatch?.[1]?.trim() ?? ''

  await db
    .insert(exercises)
    .values({
      conceptId,
      slug: frontmatter.slug,
      title: frontmatter.title,
      description: frontmatter.description,
      difficulty: frontmatter.difficulty,
      type: type ?? 'blank',
      starterCode,
      solutionCode: stripBlankMarkers(solutionCode),
      testCode,
      hints: frontmatter.hints ?? [],
      blanks: blanksInStarter,
      order: 0,
      isPublished: true,
    })
    .onConflictDoUpdate({
      target: [exercises.conceptId, exercises.slug],
      set: {
        title: frontmatter.title,
        description: frontmatter.description,
        difficulty: frontmatter.difficulty,
        type: type ?? 'blank',
        starterCode,
        solutionCode: stripBlankMarkers(solutionCode),
        testCode,
        hints: frontmatter.hints ?? [],
        blanks: blanksInStarter,
        updatedAt: new Date(),
      },
    })

  console.log(`    Imported exercise: ${frontmatter.title} (${type ?? 'blank'})`)
  return true
}

/**
 * Learning paths, from `content/paths/*.yaml`.
 *
 * Paths are written in terms of exercise *slugs* and stored as exercise ids.
 * Slugs are what a person can write and review in a diff; ids are what the
 * table holds. Resolving happens here so the two never have to meet.
 *
 * A path naming a slug that does not exist is a hard failure rather than a
 * silently shorter path — the whole point of a curated sequence is that it is
 * the sequence somebody chose, and one dropped step is invisible in the UI.
 */
async function importPaths(db: Db, contentDir: string): Promise<number> {
  const pathFiles = await glob('*.yaml', { cwd: join(contentDir, 'paths') })
  if (pathFiles.length === 0) return 0

  const allExercises = await db.select({ id: exercises.id, slug: exercises.slug }).from(exercises)
  const idBySlug = new Map(allExercises.map((exercise) => [exercise.slug, exercise.id]))

  let imported = 0

  for (const file of pathFiles.sort()) {
    const data = parseYaml(await readFile(join(contentDir, 'paths', file), 'utf-8'))
    const challengeSlugs: string[] = data.challenges ?? []

    const missing = challengeSlugs.filter((slug) => !idBySlug.has(slug))
    if (missing.length > 0) {
      throw new Error(`Path "${data.slug}" references unknown exercises: ${missing.join(', ')}`)
    }

    await db
      .insert(learningPaths)
      .values({
        slug: data.slug,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
        order: data.order ?? 0,
        challengeIds: challengeSlugs.map((slug) => idBySlug.get(slug) as string),
        isPublished: data.isPublished ?? false,
      })
      .onConflictDoUpdate({
        target: learningPaths.slug,
        set: {
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          order: data.order ?? 0,
          challengeIds: challengeSlugs.map((slug) => idBySlug.get(slug) as string),
          isPublished: data.isPublished ?? false,
          updatedAt: new Date(),
        },
      })

    imported++
    console.log(`Imported path: ${data.name} (${challengeSlugs.length} challenges)`)
  }

  return imported
}

export async function importContent(contentDir: string): Promise<ImportResult> {
  const db = createDatabaseFromEnv()
  const result: ImportResult = { tracks: 0, concepts: 0, exercises: 0, paths: 0 }

  const trackFiles = await glob('*/_track.yaml', { cwd: join(contentDir, 'tracks') })

  for (const trackFile of trackFiles) {
    const trackPath = join(contentDir, 'tracks', trackFile)
    const trackDir = dirname(trackPath)
    const track = await importTrack(db, trackPath)
    if (!track) continue

    result.tracks++
    console.log(`Imported track: ${track.name}`)

    const conceptFiles = await glob('*/_concept.yaml', { cwd: trackDir })

    for (const conceptFile of conceptFiles) {
      const conceptPath = join(trackDir, conceptFile)
      const conceptDir = dirname(conceptPath)
      const concept = await importConcept(db, conceptPath, track.id)
      if (!concept) continue

      result.concepts++
      console.log(`  Imported concept: ${concept.name}`)

      const exerciseFiles = await glob('*.md', { cwd: conceptDir })

      for (const exerciseFile of exerciseFiles) {
        const exercisePath = join(conceptDir, exerciseFile)
        if (await importExercise(db, exercisePath, concept.id)) {
          result.exercises++
        }
      }
    }
  }

  // After the exercises: a path resolves slugs to ids, so the ids have to exist.
  result.paths = await importPaths(db, contentDir)

  return result
}
