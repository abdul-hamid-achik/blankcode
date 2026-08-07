import { createDatabaseFromEnv } from '@blankcode/db/client'
import { contextSessions } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { ContextSessionStore, StoredContextSession } from './context-session-service'

type Row = typeof contextSessions.$inferSelect

function toSession(row: Row): StoredContextSession {
  return {
    id: row.id,
    userId: row.userId,
    exerciseId: row.exerciseId,
    sources: row.sources,
    required: row.required,
    selected: row.selected,
    answer: row.answer,
    status: row.status,
    revealedAt: row.revealedAt,
  }
}

export function databaseContextStore(db = createDatabaseFromEnv()): ContextSessionStore {
  return {
    async load(id) {
      // `eq(uuid, 'nonsense')` raises in Postgres, so a malformed id is a 404
      // rather than a 500.
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const row = await db.query.contextSessions.findFirst({ where: eq(contextSessions.id, id) })
      return row ? toSession(row) : null
    },

    async create({ userId, exerciseId, sources, required }) {
      const [row] = await db
        .insert(contextSessions)
        .values({ userId, exerciseId, sources: [...sources], required: [...required] })
        .returning()
      return toSession(row as Row)
    },

    async save(id, patch) {
      const { sources, required, selected, ...rest } = patch
      const [row] = await db
        .update(contextSessions)
        .set({
          ...rest,
          ...(sources ? { sources: [...sources] } : {}),
          ...(required ? { required: [...required] } : {}),
          ...(selected ? { selected: [...selected] } : {}),
          updatedAt: new Date(),
        })
        .where(eq(contextSessions.id, id))
        .returning()
      if (!row) throw new Error(`no session ${id}`)
      return toSession(row)
    },
  }
}
