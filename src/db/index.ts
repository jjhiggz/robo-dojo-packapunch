import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const makePool = () =>
  new Pool({
    connectionString,
    // Serverless-friendly defaults (Neon pooled connection string recommended)
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })

const pool = globalThis.__dbPool ?? makePool()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__dbPool = pool
}

export const db = drizzle(pool, { schema })

