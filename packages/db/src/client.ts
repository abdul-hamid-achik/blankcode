import { readFileSync } from 'node:fs'
import { make as makeDrizzle } from '@effect/sql-drizzle/Pg'
import { PgClient } from '@effect/sql-pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { PgRemoteDatabase } from 'drizzle-orm/pg-proxy'
import { Context, Layer, Redacted } from 'effect'
import pg from 'pg'
import * as schema from './schema/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads a Docker Swarm secret file if the _FILE env var is set, otherwise falls back to the direct env var. */
function resolveSecret(envVar: string, fallback: string): string {
  const filePath = process.env[`${envVar}_FILE`]
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8').trim()
    } catch {
      // Fall through to direct env var
    }
  }
  return process.env[envVar] ?? fallback
}

/**
 * Pins the SSL mode the driver already enforces.
 *
 * pg treats 'require' as an alias for 'verify-full' today and warns on every
 * boot that pg v9 will downgrade it to real libpq semantics (no certificate
 * verification). The Neon connection strings say 'require'; rewriting them to
 * 'verify-full' here keeps the strict behavior we are actually relying on
 * across that major bump, silences the warning, and means no stored secret
 * (Vercel, tvault, CI artifacts) has to be re-cut for a query-string detail.
 */
function pinSslMode(url: string): string {
  return url.replace(/\bsslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')
}

const DATABASE_URL = pinSslMode(
  resolveSecret('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/blankcode')
)

// ---------------------------------------------------------------------------
// Effect Layers — used by the API server and worker
// ---------------------------------------------------------------------------

/** Properly-typed Drizzle tag carrying the full DB schema */
export class Drizzle extends Context.Tag('Drizzle')<Drizzle, PgRemoteDatabase<typeof schema>>() {}

/** Postgres connection pool with lifecycle management */
export const PgLive = PgClient.layer({
  url: Redacted.make(DATABASE_URL),
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
    connectionString: pinSslMode(config.connectionString),
    max: config.max ?? 10,
    idleTimeoutMillis: (config.idleTimeout ?? 20) * 1000,
    connectionTimeoutMillis: (config.connectTimeout ?? 10) * 1000,
  })
  return drizzle(pool, { schema })
}

export function createDatabaseFromEnv() {
  return createDatabase({ connectionString: DATABASE_URL })
}
