import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

export type Database = ReturnType<typeof createDatabase>

export interface DatabaseConfig {
  connectionString: string
  max?: number
  idleTimeout?: number
  connectTimeout?: number
}

export function createDatabase(config: DatabaseConfig) {
  const client = postgres(config.connectionString, {
    max: config.max ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    connect_timeout: config.connectTimeout ?? 10,
  })

  return drizzle(client, { schema })
}

export function createDatabaseFromEnv() {
  const connectionString = process.env['DATABASE_URL']
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return createDatabase({ connectionString })
}
