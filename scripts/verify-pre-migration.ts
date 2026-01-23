/**
 * Pre-Migration Verification Script
 * 
 * Run this BEFORE the migration to capture baseline data.
 * This data will be used to verify the migration was successful.
 * 
 * Usage: npx tsx scripts/verify-pre-migration.ts
 */

import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { desc } from 'drizzle-orm'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

config()

// Admin emails - must match the list in src/lib/constants.ts
const ADMIN_EMAILS: readonly string[] = [
  'jonathan.higger@gmail.com',
  'aionfork@gmail.com',
  'armstrong.dan237@gmail.com',
  'tarheelwinetraders@gmail.com',
  'janyoumd@gmail.com',
  'semoyer@vt.edu',
] as const

// Define the old punches table structure (before migration)
import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core'

const oldPunches = pgTable('punches', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  userName: varchar('user_name', { length: 255 }),
  userEmail: varchar('user_email', { length: 255 }),
  type: varchar('type', { length: 10 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

interface PunchRecord {
  id: number
  userId: string
  userName: string | null
  userEmail: string | null
  type: string
  timestamp: Date
}

interface UserSummary {
  userId: string
  userName: string | null
  userEmail: string | null
  punchCount: number
  isAdmin: boolean
  totalHours: number
}

interface BaselineData {
  capturedAt: string
  totalPunchCount: number
  totalHoursAllUsers: number
  uniqueUserCount: number
  adminCount: number
  nonAdminCount: number
  users: UserSummary[]
  adminEmails: readonly string[]
}

// Calculate hours from a list of punches for a single user
const calculateHoursFromPunches = (punchList: PunchRecord[]): number => {
  // Sort punches by timestamp ascending
  const sorted = [...punchList].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  let totalMs = 0
  let lastIn: Date | null = null

  for (const p of sorted) {
    if (p.type === 'in') {
      lastIn = new Date(p.timestamp)
    } else if (p.type === 'out' && lastIn) {
      totalMs += new Date(p.timestamp).getTime() - lastIn.getTime()
      lastIn = null
    }
  }

  // If still clocked in, add time until now
  if (lastIn) {
    totalMs += Date.now() - lastIn.getTime()
  }

  return totalMs / (1000 * 60 * 60) // Convert to hours
}

const main = async () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  console.log('🔍 Pre-Migration Verification Script')
  console.log('====================================\n')

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })

  const db = drizzle(pool)

  try {
    // Get all punches
    console.log('Fetching all punches...')
    const allPunches = await db
      .select()
      .from(oldPunches)
      .orderBy(desc(oldPunches.timestamp)) as PunchRecord[]

    console.log(`Found ${allPunches.length} total punches\n`)

    // Group punches by user
    const userPunchMap = new Map<string, {
      userId: string
      userName: string | null
      userEmail: string | null
      punches: PunchRecord[]
    }>()

    for (const p of allPunches) {
      if (!userPunchMap.has(p.userId)) {
        userPunchMap.set(p.userId, {
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          punches: [],
        })
      }
      userPunchMap.get(p.userId)!.punches.push(p)
    }

    // Build user summaries
    const users: UserSummary[] = Array.from(userPunchMap.values()).map(user => {
      const isAdmin = user.userEmail 
        ? ADMIN_EMAILS.includes(user.userEmail)
        : false
      const totalHours = calculateHoursFromPunches(user.punches)

      return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        punchCount: user.punches.length,
        isAdmin,
        totalHours,
      }
    })

    // Calculate totals
    const totalHoursAllUsers = users.reduce((sum, u) => sum + u.totalHours, 0)
    const admins = users.filter(u => u.isAdmin)
    const nonAdmins = users.filter(u => !u.isAdmin)

    // Build baseline data
    const baseline: BaselineData = {
      capturedAt: new Date().toISOString(),
      totalPunchCount: allPunches.length,
      totalHoursAllUsers,
      uniqueUserCount: users.length,
      adminCount: admins.length,
      nonAdminCount: nonAdmins.length,
      users: users.sort((a, b) => b.totalHours - a.totalHours),
      adminEmails: ADMIN_EMAILS,
    }

    // Print summary
    console.log('📊 Baseline Summary')
    console.log('-------------------')
    console.log(`Total punches: ${baseline.totalPunchCount}`)
    console.log(`Total hours (all users): ${baseline.totalHoursAllUsers.toFixed(2)} hours`)
    console.log(`Unique users: ${baseline.uniqueUserCount}`)
    console.log(`  - Admins (→ Mentors board): ${baseline.adminCount}`)
    console.log(`  - Non-admins (→ Students board): ${baseline.nonAdminCount}`)

    console.log('\n👤 Admin Users (will go to Mentors board):')
    for (const admin of admins) {
      console.log(`  - ${admin.userName || 'Unknown'} (${admin.userEmail || 'no email'})`)
      console.log(`    Punches: ${admin.punchCount}, Hours: ${admin.totalHours.toFixed(2)}`)
    }

    console.log('\n👤 Non-Admin Users (will go to Students board):')
    for (const student of nonAdmins.slice(0, 10)) {
      console.log(`  - ${student.userName || 'Unknown'} (${student.userEmail || 'no email'})`)
      console.log(`    Punches: ${student.punchCount}, Hours: ${student.totalHours.toFixed(2)}`)
    }
    if (nonAdmins.length > 10) {
      console.log(`  ... and ${nonAdmins.length - 10} more students`)
    }

    // Save to file
    const outputPath = join(process.cwd(), 'scripts', 'migration-baseline.json')
    writeFileSync(outputPath, JSON.stringify(baseline, null, 2))
    console.log(`\n✅ Baseline data saved to: ${outputPath}`)

  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exitCode = 1
})
