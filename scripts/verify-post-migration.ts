/**
 * Post-Migration Verification Script
 * 
 * Run this AFTER the migration to validate data integrity.
 * Compares against baseline data captured by verify-pre-migration.ts
 * 
 * Usage: npx tsx scripts/verify-post-migration.ts
 */

import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { eq, and, desc } from 'drizzle-orm'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../src/db/schema'

config()

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

// Calculate hours from a list of punches
const calculateHoursFromPunches = (punchList: { type: string; timestamp: Date }[]): number => {
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

  if (lastIn) {
    totalMs += Date.now() - lastIn.getTime()
  }

  return totalMs / (1000 * 60 * 60)
}

const main = async () => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  console.log('🔍 Post-Migration Verification Script')
  console.log('=====================================\n')

  // Load baseline data
  const baselinePath = join(process.cwd(), 'scripts', 'migration-baseline.json')
  if (!existsSync(baselinePath)) {
    console.error('❌ ERROR: Baseline file not found!')
    console.error('   Run verify-pre-migration.ts before the migration first.')
    process.exitCode = 1
    return
  }

  const baseline: BaselineData = JSON.parse(readFileSync(baselinePath, 'utf-8'))
  console.log(`📄 Loaded baseline from: ${baseline.capturedAt}`)
  console.log(`   Pre-migration totals: ${baseline.totalPunchCount} punches, ${baseline.totalHoursAllUsers.toFixed(2)} hours\n`)

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  })

  const db = drizzle(pool, { schema })

  let allPassed = true
  const results: { check: string; passed: boolean; details: string }[] = []

  try {
    // Get SCAROB org and boards
    const scarobOrg = await db.query.organizations.findFirst({
      where: eq(schema.organizations.slug, 'scarob'),
    })

    if (!scarobOrg) {
      console.error('❌ SCAROB organization not found!')
      process.exitCode = 1
      return
    }

    const mentorsBoard = await db.query.boards.findFirst({
      where: and(
        eq(schema.boards.organizationId, scarobOrg.id),
        eq(schema.boards.slug, 'mentors')
      ),
    })

    const studentsBoard = await db.query.boards.findFirst({
      where: and(
        eq(schema.boards.organizationId, scarobOrg.id),
        eq(schema.boards.slug, 'students')
      ),
    })

    if (!mentorsBoard || !studentsBoard) {
      console.error('❌ Mentors or Students board not found!')
      process.exitCode = 1
      return
    }

    console.log(`✅ Found SCAROB org (id: ${scarobOrg.id})`)
    console.log(`   - Mentors board (id: ${mentorsBoard.id})`)
    console.log(`   - Students board (id: ${studentsBoard.id})\n`)

    // CHECK 1: Verify at least one mentor with punches
    console.log('🔍 CHECK 1: Mentor verification')
    const mentorPunches = await db.query.punches.findMany({
      where: eq(schema.punches.boardId, mentorsBoard.id),
    })

    const mentorUsers = new Map<string, typeof mentorPunches>()
    for (const p of mentorPunches) {
      if (!mentorUsers.has(p.userId)) {
        mentorUsers.set(p.userId, [])
      }
      mentorUsers.get(p.userId)!.push(p)
    }

    if (mentorUsers.size > 0) {
      const [firstMentorId, firstMentorPunches] = Array.from(mentorUsers.entries())[0]
      const mentorUser = await db.query.users.findFirst({
        where: eq(schema.users.userId, firstMentorId),
      })
      const mentorHours = calculateHoursFromPunches(firstMentorPunches)
      
      results.push({
        check: 'Mentor verification',
        passed: true,
        details: `${mentorUser?.name || 'Unknown'} (${mentorUser?.email}) has ${firstMentorPunches.length} punches, ${mentorHours.toFixed(2)} hours`,
      })
      console.log(`   ✅ Found ${mentorUsers.size} mentors with punches`)
      console.log(`   Sample: ${mentorUser?.name || 'Unknown'} (${mentorUser?.email})`)
      console.log(`   Punches: ${firstMentorPunches.length}, Hours: ${mentorHours.toFixed(2)}\n`)
    } else {
      results.push({
        check: 'Mentor verification',
        passed: false,
        details: 'No mentors found with punches',
      })
      console.log(`   ❌ No mentors found with punches!\n`)
      allPassed = false
    }

    // CHECK 2: Verify at least one student with punches
    console.log('🔍 CHECK 2: Student verification')
    const studentPunches = await db.query.punches.findMany({
      where: eq(schema.punches.boardId, studentsBoard.id),
    })

    const studentUsers = new Map<string, typeof studentPunches>()
    for (const p of studentPunches) {
      if (!studentUsers.has(p.userId)) {
        studentUsers.set(p.userId, [])
      }
      studentUsers.get(p.userId)!.push(p)
    }

    if (studentUsers.size > 0) {
      const [firstStudentId, firstStudentPunches] = Array.from(studentUsers.entries())[0]
      const studentUser = await db.query.users.findFirst({
        where: eq(schema.users.userId, firstStudentId),
      })
      const studentHours = calculateHoursFromPunches(firstStudentPunches)
      
      results.push({
        check: 'Student verification',
        passed: true,
        details: `${studentUser?.name || 'Unknown'} (${studentUser?.email}) has ${firstStudentPunches.length} punches, ${studentHours.toFixed(2)} hours`,
      })
      console.log(`   ✅ Found ${studentUsers.size} students with punches`)
      console.log(`   Sample: ${studentUser?.name || 'Unknown'} (${studentUser?.email})`)
      console.log(`   Punches: ${firstStudentPunches.length}, Hours: ${studentHours.toFixed(2)}\n`)
    } else {
      results.push({
        check: 'Student verification',
        passed: false,
        details: 'No students found with punches',
      })
      console.log(`   ❌ No students found with punches!\n`)
      allPassed = false
    }

    // CHECK 3: Total hours integrity
    console.log('🔍 CHECK 3: Hours integrity check')
    const allPunches = await db.query.punches.findMany()
    
    // Group by user and calculate total
    const userPunchMap = new Map<string, typeof allPunches>()
    for (const p of allPunches) {
      if (!userPunchMap.has(p.userId)) {
        userPunchMap.set(p.userId, [])
      }
      userPunchMap.get(p.userId)!.push(p)
    }

    let totalHoursPost = 0
    for (const userPunches of userPunchMap.values()) {
      totalHoursPost += calculateHoursFromPunches(userPunches)
    }

    const hoursDiff = Math.abs(totalHoursPost - baseline.totalHoursAllUsers)
    const hoursMatch = hoursDiff <= 1.0 // Within 1 hour tolerance

    results.push({
      check: 'Hours integrity',
      passed: hoursMatch,
      details: `Pre: ${baseline.totalHoursAllUsers.toFixed(2)}h, Post: ${totalHoursPost.toFixed(2)}h, Diff: ${hoursDiff.toFixed(2)}h`,
    })

    if (hoursMatch) {
      console.log(`   ✅ Hours match within tolerance`)
      console.log(`   Pre-migration: ${baseline.totalHoursAllUsers.toFixed(2)} hours`)
      console.log(`   Post-migration: ${totalHoursPost.toFixed(2)} hours`)
      console.log(`   Difference: ${hoursDiff.toFixed(2)} hours (tolerance: 1 hour)\n`)
    } else {
      console.log(`   ❌ Hours DO NOT match!`)
      console.log(`   Pre-migration: ${baseline.totalHoursAllUsers.toFixed(2)} hours`)
      console.log(`   Post-migration: ${totalHoursPost.toFixed(2)} hours`)
      console.log(`   Difference: ${hoursDiff.toFixed(2)} hours (exceeds 1 hour tolerance)\n`)
      allPassed = false
    }

    // CHECK 4: Punch count
    console.log('🔍 CHECK 4: Punch count verification')
    const punchCountMatch = allPunches.length === baseline.totalPunchCount

    results.push({
      check: 'Punch count',
      passed: punchCountMatch,
      details: `Pre: ${baseline.totalPunchCount}, Post: ${allPunches.length}`,
    })

    if (punchCountMatch) {
      console.log(`   ✅ Punch count matches: ${allPunches.length}\n`)
    } else {
      console.log(`   ❌ Punch count mismatch!`)
      console.log(`   Pre-migration: ${baseline.totalPunchCount}`)
      console.log(`   Post-migration: ${allPunches.length}\n`)
      allPassed = false
    }

    // CHECK 5: Membership verification
    console.log('🔍 CHECK 5: Membership verification')
    const orgMemberships = await db.query.organizationMemberships.findMany({
      where: eq(schema.organizationMemberships.organizationId, scarobOrg.id),
    })

    const adminMemberships = orgMemberships.filter(m => m.role === 'admin')
    const memberMemberships = orgMemberships.filter(m => m.role === 'member')

    const boardMemberships = await db.query.boardMemberships.findMany({
      where: eq(schema.boardMemberships.boardId, studentsBoard.id),
    })

    // Check that we have the expected number of admins
    const adminCountMatch = adminMemberships.length === baseline.adminCount
    // Check that non-admins have board memberships
    const boardMembershipMatch = boardMemberships.length === memberMemberships.length

    results.push({
      check: 'Membership verification',
      passed: adminCountMatch && boardMembershipMatch,
      details: `Admins: ${adminMemberships.length}/${baseline.adminCount}, Members with board access: ${boardMemberships.length}/${memberMemberships.length}`,
    })

    if (adminCountMatch && boardMembershipMatch) {
      console.log(`   ✅ Memberships created correctly`)
      console.log(`   Org admins: ${adminMemberships.length} (expected: ${baseline.adminCount})`)
      console.log(`   Org members: ${memberMemberships.length}`)
      console.log(`   Board memberships (Students): ${boardMemberships.length}\n`)
    } else {
      console.log(`   ⚠️ Membership count mismatch`)
      console.log(`   Org admins: ${adminMemberships.length} (expected: ${baseline.adminCount})`)
      console.log(`   Org members: ${memberMemberships.length}`)
      console.log(`   Board memberships (Students): ${boardMemberships.length}\n`)
      if (!adminCountMatch) allPassed = false
    }

    // CHECK 6: Superadmin verification
    console.log('🔍 CHECK 6: Superadmin verification')
    const superadmin = await db.query.users.findFirst({
      where: eq(schema.users.email, 'jonathan.higger@gmail.com'),
    })

    const isSuperadmin = superadmin?.globalRole === 'superadmin'

    results.push({
      check: 'Superadmin verification',
      passed: isSuperadmin,
      details: superadmin ? `${superadmin.name} (${superadmin.email}) - role: ${superadmin.globalRole}` : 'User not found',
    })

    if (isSuperadmin) {
      console.log(`   ✅ Superadmin set correctly`)
      console.log(`   ${superadmin?.name} (${superadmin?.email})\n`)
    } else {
      console.log(`   ❌ Superadmin not set correctly!`)
      console.log(`   Expected: jonathan.higger@gmail.com with role 'superadmin'`)
      console.log(`   Found: ${superadmin?.email || 'not found'} with role '${superadmin?.globalRole || 'N/A'}'\n`)
      allPassed = false
    }

    // Final summary
    console.log('=' .repeat(50))
    console.log('📊 VERIFICATION SUMMARY')
    console.log('=' .repeat(50))
    
    for (const r of results) {
      const icon = r.passed ? '✅' : '❌'
      console.log(`${icon} ${r.check}: ${r.details}`)
    }

    console.log()
    if (allPassed) {
      console.log('🎉 ALL CHECKS PASSED! Migration verified successfully.')
    } else {
      console.log('⚠️ SOME CHECKS FAILED! Please review the issues above.')
      process.exitCode = 1
    }

  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exitCode = 1
})
