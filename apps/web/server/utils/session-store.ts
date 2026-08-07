import { createDatabaseFromEnv } from '@blankcode/db/client'
import { turnSessions } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { SessionStore, StoredSession } from './turn-session-service'

type Row = typeof turnSessions.$inferSelect

function toSession(row: Row): StoredSession {
  return {
    id: row.id,
    userId: row.userId,
    exerciseId: row.exerciseId,
    maxTurns: row.maxTurns,
    turnsUsed: row.turnsUsed,
    messages: row.messages,
    finalCode: row.finalCode,
    status: row.status,
    revealedAt: row.revealedAt,
  }
}

/**
 * The real store. Deliberately thin: everything worth reasoning about lives in
 * the service, which is why the service takes this as a parameter.
 */
export function databaseStore(db = createDatabaseFromEnv()): SessionStore {
  return {
    async load(id) {
      // A malformed id is a 404, not a 500: `eq(uuid, 'nonsense')` raises in
      // Postgres rather than returning nothing.
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const row = await db.query.turnSessions.findFirst({ where: eq(turnSessions.id, id) })
      return row ? toSession(row) : null
    },

    async create({ userId, exerciseId, maxTurns }) {
      const [row] = await db
        .insert(turnSessions)
        .values({ userId, exerciseId, maxTurns })
        .returning()
      return toSession(row as Row)
    },

    async save(id, patch) {
      // `messages` is readonly on the service's type and mutable on the column;
      // copied rather than cast so the stored array is never the same object the
      // caller still holds.
      const { messages, ...rest } = patch
      const [row] = await db
        .update(turnSessions)
        .set({
          ...rest,
          ...(messages ? { messages: [...messages] } : {}),
          updatedAt: new Date(),
        })
        .where(eq(turnSessions.id, id))
        .returning()
      if (!row) throw new Error(`no session ${id}`)
      return toSession(row)
    },
  }
}
