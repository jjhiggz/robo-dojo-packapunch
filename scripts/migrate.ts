import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const MIGRATIONS_FOLDER = new URL('../drizzle', import.meta.url).pathname

// Global advisory lock key to prevent parallel deploys from racing migrations
// Any int8 is valid; keep stable for this project.
const LOCK_KEY = 6843123412341234n

const requireEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required env var: ${key}`)
  return value
}

const main = async () => {
  const connectionString = requireEnv('DATABASE_URL')

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })

  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY.toString()])

    const db = drizzle(client)
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY.toString()])
    } catch {
      // best-effort unlock
    }
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})


