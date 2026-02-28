import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { desc, isNull, eq } from 'drizzle-orm'
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

  // Check for "scarob" organization
  const orgs = await db.query.organizations.findMany()
  console.log('Organizations:', orgs.map(o => `${o.id}: ${o.name} (${o.slug})`))

  const scarobOrg = orgs.find(o => o.slug.toLowerCase().includes('scarob') || o.name.toLowerCase().includes('scarob'))
  
  if (!scarobOrg) {
    console.log('\nNo "scarob" organization found. Listing all orgs above.')
    console.log('\nChecking January/February punches for all boards...')
  } else {
    console.log(`\nFound scarob org: ${scarobOrg.name} (id: ${scarobOrg.id})`)
  }

  console.log('\n--- Checking for any NULL userName entries ---')
  const nullNamePunches = await db
    .select()
    .from(schema.punches)
    .where(isNull(schema.punches.userName))
    .limit(10)

  console.log(`Punches with NULL userName: ${nullNamePunches.length}`)
  
  console.log('\n--- Recent punches sample ---')
  const recentPunches = await db
    .select({
      id: schema.punches.id,
      userId: schema.punches.userId,
      userName: schema.punches.userName,
      userEmail: schema.punches.userEmail,
      timestamp: schema.punches.timestamp,
      boardId: schema.punches.boardId,
    })
    .from(schema.punches)
    .orderBy(desc(schema.punches.timestamp))
    .limit(15)

  console.log('Recent punches:')
  for (const p of recentPunches) {
    console.log(`  ${p.timestamp?.toISOString().split('T')[0]} | ${p.userName || 'NULL'} | ${p.userEmail || 'NULL'} | board:${p.boardId}`)
  }

  // Check user-punch alignment
  console.log('\n--- Checking user data alignment ---')
  const samplePunch = recentPunches[0]
  if (samplePunch) {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.userId, samplePunch.userId)
    })
    console.log(`Punch userId: ${samplePunch.userId}`)
    console.log(`Punch userName: ${samplePunch.userName}`)
    console.log(`User name from users table: ${user?.name}`)
    console.log(`Match: ${samplePunch.userName === user?.name ? 'YES' : 'NO'}`)
  }

  await pool.end()
}

main().catch((err) => {
  console.error('Error:', err)
  process.exitCode = 1
})
