import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type createDatabaseFromEnv, readingExercises } from '@blankcode/db'
import { DIFFICULTIES } from '@blankcode/shared'
import { notInArray } from 'drizzle-orm'
import { glob } from 'glob'
import { parse as parseYaml } from 'yaml'

/**
 * Reading exercises: `content/reading/<slug>.yaml` into `reading_exercises`.
 *
 * Its own file because the shape shares nothing with a blank exercise — no
 * starter, no tests, no concept to hang it off. A reading exercise is a small
 * codebase plus the rubric a complete explanation has to cover, and the rubric
 * is the answer key: it is imported so the server can grade against it, and it
 * is the one thing the detail endpoint must never send to a browser.
 *
 * Validation throws rather than skipping the file. A blank exercise that fails
 * to parse is one missing exercise; a reading exercise with a malformed rubric
 * is an exercise that grades everyone against nothing and still returns a
 * number, which is worse than not shipping it.
 */

type Db = ReturnType<typeof createDatabaseFromEnv>

export interface ReadingFile {
  path: string
  content: string
}

export interface ReadingRubricPoint {
  id: string
  point: string
  weight: number
}

export interface ReadingExerciseInput {
  slug: string
  title: string
  brief: string
  language: string
  difficulty: string
  files: ReadingFile[]
  rubric: ReadingRubricPoint[]
  isPublished: boolean
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`)
}

function requireString(file: string, value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(file, `${field} must be a non-empty string`)
  }
  const trimmed = value.trim()
  if (trimmed.length > maxLength) {
    fail(file, `${field} is ${trimmed.length} characters; the column holds ${maxLength}`)
  }
  return trimmed
}

/**
 * A parsed document, or an exception naming the field.
 *
 * Exported because it is the only part of the import worth testing on its own:
 * everything else here is a database call.
 */
export function parseReadingExercise(raw: unknown, file: string): ReadingExerciseInput {
  if (typeof raw !== 'object' || raw === null) fail(file, 'is not a YAML mapping')
  const doc = raw as Record<string, unknown>

  const slug = requireString(file, doc['slug'], 'slug', 100)
  if (!SLUG_PATTERN.test(slug)) fail(file, `slug "${slug}" must be lowercase words joined by -`)

  const difficulty = requireString(file, doc['difficulty'], 'difficulty', 20)
  if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
    fail(file, `difficulty "${difficulty}" is not one of ${DIFFICULTIES.join(', ')}`)
  }

  const rawFiles = doc['files']
  if (!Array.isArray(rawFiles) || rawFiles.length === 0)
    fail(file, 'files must be a non-empty list')

  const paths = new Set<string>()
  const files = rawFiles.map((entry, index): ReadingFile => {
    if (typeof entry !== 'object' || entry === null) fail(file, `files[${index}] is not a mapping`)
    const row = entry as Record<string, unknown>
    const path = requireString(file, row['path'], `files[${index}].path`, 200)
    if (paths.has(path)) fail(file, `files lists "${path}" twice`)
    paths.add(path)
    if (typeof row['content'] !== 'string' || row['content'].length === 0) {
      fail(file, `files[${index}].content must be a non-empty string`)
    }
    return { path, content: row['content'] }
  })

  const rawRubric = doc['rubric']
  if (!Array.isArray(rawRubric) || rawRubric.length === 0) {
    fail(file, 'rubric must be a non-empty list')
  }

  const ids = new Set<string>()
  const rubric = rawRubric.map((entry, index): ReadingRubricPoint => {
    if (typeof entry !== 'object' || entry === null) fail(file, `rubric[${index}] is not a mapping`)
    const row = entry as Record<string, unknown>
    const id = requireString(file, row['id'], `rubric[${index}].id`, 60)
    // The id is how a graded result is matched back to the authored point. Two
    // points sharing one means the grader's answer for either becomes the
    // answer for both, silently.
    if (ids.has(id)) fail(file, `rubric lists the id "${id}" twice`)
    ids.add(id)
    const point = requireString(file, row['point'], `rubric[${index}].point`, 500)
    const weight = row['weight']
    if (typeof weight !== 'number' || !Number.isInteger(weight) || weight < 1 || weight > 3) {
      fail(file, `rubric[${index}].weight must be an integer from 1 to 3`)
    }
    return { id, point, weight }
  })

  return {
    slug,
    title: requireString(file, doc['title'], 'title', 200),
    brief: requireString(file, doc['brief'], 'brief', 2000),
    language: requireString(file, doc['language'], 'language', 20),
    difficulty,
    files,
    rubric,
    isPublished: doc['isPublished'] === undefined ? false : doc['isPublished'] === true,
  }
}

/**
 * Upserts every `content/reading/*.yaml` and removes the rows that no longer
 * have a file, the way the learning paths do — an exercise that was renamed
 * otherwise keeps being served under its old slug forever.
 *
 * The delete is skipped when the directory yields nothing. `notInArray` with an
 * empty list is `true`, so a mistyped content path or a half-checked-out tree
 * would delete the whole table and report a clean import.
 */
export async function importReading(db: Db, contentDir: string): Promise<number> {
  const dir = join(contentDir, 'reading')
  const files = (await glob('*.yaml', { cwd: dir })).toSorted()

  if (files.length === 0) {
    console.log('No reading exercises found; leaving reading_exercises untouched')
    return 0
  }

  const slugs: string[] = []

  for (const name of files) {
    const parsed = parseReadingExercise(parseYaml(await readFile(join(dir, name), 'utf-8')), name)
    const values = {
      slug: parsed.slug,
      title: parsed.title,
      brief: parsed.brief,
      language: parsed.language,
      difficulty: parsed.difficulty,
      files: parsed.files,
      rubric: parsed.rubric,
      isPublished: parsed.isPublished,
    }

    await db
      .insert(readingExercises)
      .values(values)
      .onConflictDoUpdate({
        target: readingExercises.slug,
        set: { ...values, updatedAt: new Date() },
      })

    slugs.push(parsed.slug)
    const weight = parsed.rubric.reduce((total, point) => total + point.weight, 0)
    console.log(
      `Imported reading: ${parsed.title} (${parsed.files.length} files, ${parsed.rubric.length} rubric points, ${weight} marks)`
    )
  }

  const removed = await db
    .delete(readingExercises)
    .where(notInArray(readingExercises.slug, slugs))
    .returning({ slug: readingExercises.slug })

  for (const row of removed) console.log(`Removed stale reading exercise: ${row.slug}`)

  return slugs.length
}
