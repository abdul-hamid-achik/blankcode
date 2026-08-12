import { createDatabaseFromEnv } from '@blankcode/db/client'
import { agentSessions } from '@blankcode/db/schema'
import { eq } from 'drizzle-orm'
import type { AgentEvent } from './agent-session'
import type { AgentSessionStore, StoredAgentSession } from './agent-session-service'

type Row = typeof agentSessions.$inferSelect

function toSession(row: Row): StoredAgentSession {
  return {
    id: row.id,
    userId: row.userId,
    exerciseId: row.exerciseId,
    status: row.status,
    beatIndex: row.beatIndex,
    maxAgentTurns: row.maxAgentTurns,
    agentTurnsUsed: row.agentTurnsUsed,
    maxInterventions: row.maxInterventions,
    interventionsUsed: row.interventionsUsed,
    events: row.events as AgentEvent[],
    revealedAt: row.revealedAt,
    script: row.script,
    currentCode: row.currentCode,
    lastEvidence: row.lastEvidence,
    workPassed: row.workPassed,
    finalCode: row.finalCode,
  }
}

export function agentDatabaseStore(db = createDatabaseFromEnv()): AgentSessionStore {
  return {
    async load(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null
      const row = await db.query.agentSessions.findFirst({ where: eq(agentSessions.id, id) })
      return row ? toSession(row) : null
    },

    async create({ userId, exerciseId, script, maxAgentTurns, maxInterventions, currentCode }) {
      const [row] = await db
        .insert(agentSessions)
        .values({
          userId,
          exerciseId,
          script,
          maxAgentTurns,
          maxInterventions,
          currentCode,
          agentTurnsUsed: 1,
          beatIndex: 0,
        })
        .returning()
      return toSession(row as Row)
    },

    async save(id, patch) {
      const { events, script, lastEvidence, ...rest } = patch
      const [row] = await db
        .update(agentSessions)
        .set({
          ...rest,
          ...(events ? { events: [...events] } : {}),
          ...(script ? { script } : {}),
          ...(lastEvidence !== undefined ? { lastEvidence } : {}),
          updatedAt: new Date(),
        })
        .where(eq(agentSessions.id, id))
        .returning()
      if (!row) throw new Error(`no agent session ${id}`)
      return toSession(row)
    },
  }
}
