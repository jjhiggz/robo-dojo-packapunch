import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, isNull, or } from 'drizzle-orm'
import * as schema from '../src/db/schema'

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

  const db = drizzle(pool, { schema })

  console.log('Finding punches with missing user data...')

  // Find all punches where userName OR userEmail is NULL
  const punchesWithMissingData = await db
    .select({
      id: schema.punches.id,
      userId: schema.punches.userId,
      userName: schema.punches.userName,
      userEmail: schema.punches.userEmail,
    })
    .from(schema.punches)
    .where(
      or(
        isNull(schema.punches.userName),
        isNull(schema.punches.userEmail)
      )
    )

  console.log(`Found ${punchesWithMissingData.length} punches with missing data`)

  if (punchesWithMissingData.length === 0) {
    console.log('No punches to update!')
    await pool.end()
    return
  }

  // Get unique user IDs that need lookup
  const userIds = [...new Set(punchesWithMissingData.map(p => p.userId))]
  console.log(`Looking up ${userIds.length} unique users...`)

  // Fetch all users in one query
  const usersData = await db.query.users.findMany({
    where: (users, { inArray }) => inArray(users.userId, userIds),
  })

  const userMap = new Map(usersData.map(u => [u.userId, u]))
  console.log(`Found ${usersData.length} users in database`)

  // Track stats
  let updated = 0
  let skipped = 0
  let notFound = 0

  // Update punches in batches
  for (const punch of punchesWithMissingData) {
    const user = userMap.get(punch.userId)
    
    if (!user) {
      console.log(`  [SKIP] No user found for userId: ${punch.userId} (punch ${punch.id})`)
      notFound++
      continue
    }

    // Only update if there's actually missing data
    const needsUpdate = !punch.userName || !punch.userEmail
    if (!needsUpdate) {
      skipped++
      continue
    }

    await db
      .update(schema.punches)
      .set({
        userName: punch.userName || user.name || null,
        userEmail: punch.userEmail || user.email,
      })
      .where(eq(schema.punches.id, punch.id))

    updated++
    
    if (updated % 100 === 0) {
      console.log(`  Updated ${updated} punches...`)
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Updated: ${updated}`)
  console.log(`Skipped (already had data): ${skipped}`)
  console.log(`Not found (no user record): ${notFound}`)

  // Verify the fix
  console.log('\nVerifying remaining punches with missing data...')
  const remaining = await db
    .select({ count: schema.punches.id })
    .from(schema.punches)
    .where(
      or(
        isNull(schema.punches.userName),
        isNull(schema.punches.userEmail)
      )
    )

  console.log(`Remaining punches with missing data: ${remaining.length}`)

  await pool.end()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exitCode = 1
})
