import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { concepts, createDatabaseFromEnv, exercises, learningPaths, tracks } from '@blankcode/db'
import { parseExercise, stripBlankMarkers } from '@blankcode/exercise-parser'
import { LEARNING_PATHS } from '@blankcode/shared'
import { notInArray } from 'drizzle-orm'
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

  const { frontmatter, starterCode, solutionCode, blanksInStarter, type, contextSources } =
    parseResult.exercise
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
      contextSources: contextSources ?? null,
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
        contextSources: contextSources ?? null,
        updatedAt: new Date(),
      },
    })

  console.log(`    Imported exercise: ${frontmatter.title} (${type ?? 'blank'})`)
  return true
}

/**
 * Learning paths.
 *
 * `LEARNING_PATHS` is the single definition: the /paths index and the 404 guard
 * on the detail page both read it directly, so it has to stay the thing that
 * decides which paths exist. This function's job is to make the database agree
 * with it.
 *
 * The translation is the reason this exists. A path lists its challenges by
 * *slug*, which is what a person can write and review; the detail page then
 * asks the API for each one by the value stored here, and that lookup is on
 * `exercises.id` — a uuid. Writing the slugs through unchanged produced a table
 * that looked populated and a page that could not resolve a single exercise.
 *
 * An unknown slug fails the import. A path that silently loses a step is worse
 * than one that never imported: the sequence is the whole point, and a missing
 * step is invisible in the UI.
 */
async function importPaths(db: Db): Promise<number> {
  const allExercises = await db.select({ id: exercises.id, slug: exercises.slug }).from(exercises)
  const idBySlug = new Map(allExercises.map((exercise) => [exercise.slug, exercise.id]))

  let imported = 0

  for (const path of LEARNING_PATHS) {
    const missing = path.challengeIds.filter((slug) => !idBySlug.has(slug))
    if (missing.length > 0) {
      throw new Error(`Path "${path.slug}" references unknown exercises: ${missing.join(', ')}`)
    }

    const challengeIds = path.challengeIds.map((slug) => idBySlug.get(slug) as string)
    const values = {
      slug: path.slug,
      name: path.name,
      description: path.description,
      icon: path.icon,
      color: path.color,
      order: path.order,
      challengeIds,
      isPublished: path.isPublished,
    }

    await db
      .insert(learningPaths)
      .values(values)
      .onConflictDoUpdate({
        target: learningPaths.slug,
        set: { ...values, updatedAt: new Date() },
      })

    imported++
    console.log(`Imported path: ${path.name} (${challengeIds.length} challenges)`)
  }

  /*
   * Anything left behind is a path that used to exist and does not any more —
   * renamed, or dropped. Upserting alone never removes it, so it keeps being
   * served with challenge ids that may no longer resolve. Five of those were
   * sitting in both databases before this ran.
   */
  const removed = await db
    .delete(learningPaths)
    .where(
      notInArray(
        learningPaths.slug,
        LEARNING_PATHS.map((path) => path.slug)
      )
    )
    .returning({ slug: learningPaths.slug })

  for (const path of removed) console.log(`Removed stale path: ${path.slug}`)

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
  result.paths = await importPaths(db)

  return result
}
