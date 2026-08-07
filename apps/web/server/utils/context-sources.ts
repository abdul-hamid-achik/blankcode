import { createDatabaseFromEnv } from '@blankcode/db/client'
import { exercises } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { ContextSource } from './context-budget'

/**
 * A context exercise's sources, read from the exercise itself.
 *
 * They are authored in the markdown under `## Context` and imported onto the
 * row, so a source's price and contents live next to the question they belong
 * to and change with it in one commit.
 *
 * Simulated sources rather than real connectors, deliberately: the skill is
 * deciding *what* a model needs to see, and that does not change every six
 * months the way the plumbing does. A live server would also make the exercise
 * unreproducible and put a network dependency inside grading.
 */

type Definition = NonNullable<typeof exercises.$inferSelect.contextSources>

async function definitionFor(exerciseId: string): Promise<Definition | null> {
  const db = createDatabaseFromEnv()
  const row = await db.query.exercises.findFirst({
    where: eq(exercises.id, exerciseId),
    columns: { contextSources: true },
  })
  return row?.contextSources ?? null
}

export async function sourcesFor(
  exerciseId: string
): Promise<{ sources: readonly ContextSource[]; required: readonly string[] } | null> {
  const definition = await definitionFor(exerciseId)
  if (!definition) return null

  // Contents are dropped here. This is what builds the menu, and the menu is
  // public — prices and labels only. Handing the contents over is what the
  // learner is being charged for.
  return {
    sources: definition.sources.map(({ id, label, tokens }) => ({ id, label, tokens })),
    required: definition.required,
  }
}

export async function contentFor(exerciseId: string, sourceId: string): Promise<string> {
  const definition = await definitionFor(exerciseId)
  return definition?.sources.find((source) => source.id === sourceId)?.content ?? ''
}

/**
 * Whether an answer is accepted.
 *
 * The pattern is authored per exercise. Compiled here rather than stored
 * compiled, and a broken pattern rejects rather than throws: an exercise with a
 * bad regex should fail closed, not 500 on every submission.
 */
export async function checkAnswer(exerciseId: string, answer: string): Promise<boolean> {
  const definition = await definitionFor(exerciseId)
  if (!definition?.accept) return false

  try {
    return new RegExp(definition.accept, 'i').test(answer)
  } catch (error) {
    console.error(`[context] exercise ${exerciseId} has an invalid accept pattern:`, String(error))
    return false
  }
}
