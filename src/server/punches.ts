import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import { punches } from '@/db/schema'

// Get the current punch status for a user (are they clocked in or out?)
export const getPunchStatus = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const lastPunch = await db
      .select()
      .from(punches)
      .where(eq(punches.userId, userId))
      .orderBy(desc(punches.timestamp))
      .limit(1)

    if (lastPunch.length === 0) {
      return { isClockedIn: false, lastPunch: null }
    }

    return {
      isClockedIn: lastPunch[0].type === 'in',
      lastPunch: lastPunch[0],
    }
  })

// Punch in or out
export const punch = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; userName?: string; userEmail?: string; type: 'in' | 'out' }) => data)
  .handler(async ({ data }) => {
    const [newPunch] = await db
      .insert(punches)
      .values({
        userId: data.userId,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        type: data.type,
        timestamp: new Date(),
      })
      .returning()

    return newPunch
  })

// Get today's punches for a user
export const getTodayPunches = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, userId),
          gte(punches.timestamp, today),
          lte(punches.timestamp, tomorrow)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

// Get punches for a user within a date range
export const getPunchHistory = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(data.endDate)
    end.setHours(23, 59, 59, 999)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

// Calculate total hours worked from a list of punches
export const calculateHoursFromPunches = (punchList: { type: string; timestamp: Date }[]): number => {
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

// Admin: Get all punches for today (all users)
export const getAllTodayPunches = createServerFn().handler(async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return await db
    .select()
    .from(punches)
    .where(
      and(
        gte(punches.timestamp, today),
        lte(punches.timestamp, tomorrow)
      )
    )
    .orderBy(desc(punches.timestamp))
})

// Admin: Get all unique users with their latest punch status
export const getAllUsersStatus = createServerFn().handler(async () => {
  // Get the most recent punch for each user
  const latestPunches = await db
    .select()
    .from(punches)
    .orderBy(desc(punches.timestamp))

  // Group by user and get their latest punch
  const userMap = new Map<string, typeof latestPunches[0]>()
  for (const p of latestPunches) {
    if (!userMap.has(p.userId)) {
      userMap.set(p.userId, p)
    }
  }

  return Array.from(userMap.values()).map(p => ({
    userId: p.userId,
    userName: p.userName,
    userEmail: p.userEmail,
    isClockedIn: p.type === 'in',
    lastPunchTime: p.timestamp,
  }))
})

// Admin: Get punches for a specific user within a date range
export const getUserPunchHistory = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(data.endDate)
    end.setHours(23, 59, 59, 999)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

// Get weekly summary for a user (hours per day)
export const getWeeklySummary = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; weekStart: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.weekStart)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    const weekPunches = await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

    // Group punches by day and calculate hours
    const dailyHours: { date: string; hours: number }[] = []
    
    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(start)
      dayStart.setDate(dayStart.getDate() + i)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const dayPunches = weekPunches.filter(p => {
        const t = new Date(p.timestamp)
        return t >= dayStart && t < dayEnd
      })

      dailyHours.push({
        date: dayStart.toISOString().split('T')[0],
        hours: calculateHoursFromPunches(dayPunches),
      })
    }

    return dailyHours
  })

// Admin: Get monthly stats for all users
export const getAllUsersMonthlyStats = createServerFn({ method: 'POST' })
  .inputValidator((data: { month: string }) => data) // month format: "2026-01"
  .handler(async ({ data }) => {
    const [year, month] = data.month.split('-').map(Number)
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999) // Last day of month

    const monthPunches = await db
      .select()
      .from(punches)
      .where(
        and(
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

    // Group by user
    const userPunches = new Map<string, { 
      userId: string
      userName: string | null
      userEmail: string | null
      punches: typeof monthPunches
    }>()

    for (const p of monthPunches) {
      if (!userPunches.has(p.userId)) {
        userPunches.set(p.userId, {
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          punches: [],
        })
      }
      userPunches.get(p.userId)!.punches.push(p)
    }

    // Calculate stats for each user
    return Array.from(userPunches.values()).map(user => {
      const totalHours = calculateHoursFromPunches(user.punches)
      const daysWorked = new Set(
        user.punches.map(p => new Date(p.timestamp).toISOString().split('T')[0])
      ).size
      const punchCount = user.punches.length

      return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        totalHours,
        daysWorked,
        punchCount,
        avgHoursPerDay: daysWorked > 0 ? totalHours / daysWorked : 0,
      }
    }).sort((a, b) => b.totalHours - a.totalHours) // Sort by most hours
  })

// Admin: Get user's monthly breakdown (hours per week)
export const getUserMonthlyBreakdown = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; month: string }) => data)
  .handler(async ({ data }) => {
    const [year, month] = data.month.split('-').map(Number)
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)

    const monthPunches = await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

    // Group by week
    const weeklyBreakdown: { weekStart: string; weekEnd: string; hours: number; days: number }[] = []
    
    let currentWeekStart = new Date(start)
    // Adjust to start of week (Sunday)
    currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay())

    while (currentWeekStart <= end) {
      const weekEnd = new Date(currentWeekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const weekPunches = monthPunches.filter(p => {
        const t = new Date(p.timestamp)
        return t >= currentWeekStart && t <= weekEnd
      })

      const hours = calculateHoursFromPunches(weekPunches)
      const days = new Set(
        weekPunches.map(p => new Date(p.timestamp).toISOString().split('T')[0])
      ).size

      if (hours > 0 || (currentWeekStart >= start && currentWeekStart <= end)) {
        weeklyBreakdown.push({
          weekStart: currentWeekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0],
          hours,
          days,
        })
      }

      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    return weeklyBreakdown
  })

// Admin: Update a punch record's timestamp and/or type
export const updatePunch = createServerFn({ method: 'POST' })
  .inputValidator((data: { punchId: number; timestamp: string; type?: 'in' | 'out' }) => data)
  .handler(async ({ data }) => {
    const [updated] = await db
      .update(punches)
      .set({
        timestamp: new Date(data.timestamp),
        ...(data.type && { type: data.type }),
      })
      .where(eq(punches.id, data.punchId))
      .returning()

    return updated
  })

// Admin: Delete a punch record
export const deletePunch = createServerFn({ method: 'POST' })
  .inputValidator((punchId: number) => punchId)
  .handler(async ({ data: punchId }) => {
    await db.delete(punches).where(eq(punches.id, punchId))
    return { success: true }
  })

// Admin: Delete multiple punch records
export const deletePunches = createServerFn({ method: 'POST' })
  .inputValidator((punchIds: number[]) => punchIds)
  .handler(async ({ data: punchIds }) => {
    if (punchIds.length === 0) return { success: true, deleted: 0 }
    await db.delete(punches).where(inArray(punches.id, punchIds))
    return { success: true, deleted: punchIds.length }
  })

// Admin: Manually add a punch for a user
export const addPunch = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    userId: string
    userName?: string
    userEmail?: string
    type: 'in' | 'out'
    timestamp: string
  }) => data)
  .handler(async ({ data }) => {
    const [newPunch] = await db
      .insert(punches)
      .values({
        userId: data.userId,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        type: data.type,
        timestamp: new Date(data.timestamp),
      })
      .returning()

    return newPunch
  })

