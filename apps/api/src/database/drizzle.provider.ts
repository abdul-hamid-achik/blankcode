import type { Provider } from '@nestjs/common'
import { createDatabase, type Database } from '@blankcode/db'
import { config } from '../config/index.js'

export const DRIZZLE = Symbol('DRIZZLE')

export const DrizzleProvider: Provider<Database> = {
  provide: DRIZZLE,
  useFactory: () => {
    return createDatabase({
      connectionString: config.database.url,
      max: 10,
      idleTimeout: 20,
      connectTimeout: 10,
    })
  },
}

export type { Database }
