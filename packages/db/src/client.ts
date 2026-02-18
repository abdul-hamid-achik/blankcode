import { make as makeDrizzle } from '@effect/sql-drizzle/Pg'
import { PgClient } from '@effect/sql-pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgRemoteDatabase } from 'drizzle-orm/pg-proxy'
import { Context, Layer, Redacted } from 'effect'
import pg from 'pg'
import * as schema from './schema/index.js'

// ---------------------------------------------------------------------------
// Effect Layers — used by the API server and worker
// ---------------------------------------------------------------------------

/** Properly-typed Drizzle tag carrying the full DB schema */
export class Drizzle extends Context.Tag('Drizzle')<Drizzle, PgRemoteDatabase<typeof schema>>() {}

/** Postgres connection pool with lifecycle management */
export const PgLive = PgClient.layer({
  url: Redacted.make(
    process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/blankcode'
  ),
  maxConnections: 10,
  idleTimeout: 20_000,
  connectTimeout: 10_000,
})

/** Drizzle instance backed by @effect/sql PgClient, with full schema typing. */
export const DrizzleLive = Layer.effect(Drizzle, makeDrizzle({ schema }))

/** Combined: provides Drizzle + PgClient + SqlClient */
export const DatabaseLive = Layer.provideMerge(DrizzleLive, PgLive)

// ---------------------------------------------------------------------------
// Legacy compat — used by drizzle-kit CLI, content-importer, and other
// non-Effect consumers that need a plain Drizzle instance.
// ---------------------------------------------------------------------------

export type Database = ReturnType<typeof createDatabase>

export function createDatabase(config: {
  connectionString: string
  max?: number
  idleTimeout?: number
  connectTimeout?: number
}) {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.max ?? 10,
    idleTimeoutMillis: (config.idleTimeout ?? 20) * 1000,
    connectionTimeoutMillis: (config.connectTimeout ?? 10) * 1000,
  })
  return drizzle(pool, { schema })
}

export function createDatabaseFromEnv() {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return createDatabase({ connectionString })
}
