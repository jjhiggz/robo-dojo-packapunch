import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import {
  punches,
  users,
  organizations,
  boards,
  organizationMemberships,
  boardMemberships,
} from '@/db/schema'

// USER & ROLE FUNCTIONS

export const ensureUser = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; email: string; name?: string }) => data)
  .handler(async ({ data }) => {
    // First check by userId (exact match)
    const existingById = await db.query.users.findFirst({
      where: eq(users.userId, data.userId),
    })

    if (existingById) {
      if (existingById.email !== data.email || existingById.name !== data.name) {
        const [updated] = await db
          .update(users)
          .set({ email: data.email, name: data.name || existingById.name })
          .where(eq(users.userId, data.userId))
          .returning()
        return updated
      }
      return existingById
    }

    // Check by email (case-insensitive) - handles Clerk ID changes
    const normalizedEmail = data.email.toLowerCase()
    const allUsers = await db.query.users.findMany()
    const existingByEmail = allUsers.find(u => u.email.toLowerCase() === normalizedEmail)

    if (existingByEmail) {
      // User exists with different Clerk ID - update the userId and merge
      // Also update all related records (memberships, punches)
      await db
        .update(organizationMemberships)
        .set({ userId: data.userId })
        .where(eq(organizationMemberships.userId, existingByEmail.userId))

      await db
        .update(boardMemberships)
        .set({ userId: data.userId })
        .where(eq(boardMemberships.userId, existingByEmail.userId))

      await db
        .update(punches)
        .set({ userId: data.userId })
        .where(eq(punches.userId, existingByEmail.userId))

      // Update the user record with new userId
      const [updated] = await db
        .update(users)
        .set({ 
          userId: data.userId, 
          email: data.email,
          name: data.name || existingByEmail.name 
        })
        .where(eq(users.userId, existingByEmail.userId))
        .returning()

      return updated
    }

    // No existing user found - create new
    const [newUser] = await db
      .insert(users)
      .values({
        userId: data.userId,
        email: data.email,
        name: data.name || null,
        globalRole: 'user',
      })
      .returning()

    return newUser
  })

export const getUserGlobalRole = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.userId, userId),
    })
    return user?.globalRole ?? 'user'
  })

export const isSuperAdmin = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.userId, userId),
    })
    return user?.globalRole === 'superadmin'
  })

export const getUserOrgRole = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; organizationId: number }) => data)
  .handler(async ({ data }) => {
    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, data.organizationId)
      ),
    })
    return membership?.role ?? null
  })

export const isOrgAdmin = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; organizationId: number }) => data)
  .handler(async ({ data }) => {
    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, data.organizationId)
      ),
    })
    return membership?.role === 'admin'
  })

export const getUserOrganizations = createServerFn({ method: 'POST' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const memberships = await db.query.organizationMemberships.findMany({
      where: eq(organizationMemberships.userId, userId),
      with: {
        organization: true,
      },
    })
    return memberships.map(m => ({
      ...m.organization,
      role: m.role,
    }))
  })

export const getUserBoardsInOrg = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; organizationId: number }) => data)
  .handler(async ({ data }) => {
    const orgMembership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, data.organizationId)
      ),
    })

    if (!orgMembership) {
      return []
    }

    if (orgMembership.role === 'admin') {
      return await db.query.boards.findMany({
        where: eq(boards.organizationId, data.organizationId),
      })
    }

    const memberBoards = await db.query.boardMemberships.findMany({
      where: eq(boardMemberships.userId, data.userId),
      with: {
        board: true,
      },
    })

    return memberBoards
      .filter(m => m.board.organizationId === data.organizationId)
      .map(m => m.board)
  })

// ORGANIZATION FUNCTIONS

export const createOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.userId, data.userId),
    })
    if (user?.globalRole !== 'superadmin') {
      throw new Error('Only superadmins can create organizations')
    }

    const [org] = await db
      .insert(organizations)
      .values({ name: data.name, slug: data.slug })
      .returning()

    await db.insert(organizationMemberships).values({
      userId: data.userId,
      organizationId: org.id,
      role: 'admin',
    })

    return org
  })

export const getOrganizationBySlug = createServerFn({ method: 'POST' })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    return await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    })
  })

// BOARD FUNCTIONS

export const createBoard = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; organizationId: number; name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, data.organizationId)
      ),
    })
    if (membership?.role !== 'admin') {
      throw new Error('Only organization admins can create boards')
    }

    const [board] = await db
      .insert(boards)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
      })
      .returning()

    return board
  })

export const getBoardBySlug = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: number; slug: string }) => data)
  .handler(async ({ data }) => {
    return await db.query.boards.findFirst({
      where: and(
        eq(boards.organizationId, data.organizationId),
        eq(boards.slug, data.slug)
      ),
    })
  })

export const updateBoard = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number; name: string; slug: string }) => data)
  .handler(async ({ data }) => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, data.boardId),
    })
    if (!board) throw new Error('Board not found')

    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, board.organizationId)
      ),
    })
    if (membership?.role !== 'admin') {
      throw new Error('Only organization admins can update boards')
    }

    const [updated] = await db
      .update(boards)
      .set({
        name: data.name,
        slug: data.slug,
      })
      .where(eq(boards.id, data.boardId))
      .returning()

    return updated
  })

export const deleteBoard = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number }) => data)
  .handler(async ({ data }) => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, data.boardId),
    })
    if (!board) throw new Error('Board not found')

    const membership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.userId),
        eq(organizationMemberships.organizationId, board.organizationId)
      ),
    })
    if (membership?.role !== 'admin') {
      throw new Error('Only organization admins can delete boards')
    }

    // Delete related board memberships first
    await db.delete(boardMemberships).where(eq(boardMemberships.boardId, data.boardId))

    // Then delete the board
    await db.delete(boards).where(eq(boards.id, data.boardId))

    return { success: true }
  })

// MEMBERSHIP FUNCTIONS

export const inviteToOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    inviterId: string
    targetUserId: string
    organizationId: number
    role: 'admin' | 'member'
  }) => data)
  .handler(async ({ data }) => {
    const inviterMembership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.inviterId),
        eq(organizationMemberships.organizationId, data.organizationId)
      ),
    })
    if (inviterMembership?.role !== 'admin') {
      throw new Error('Only organization admins can invite users')
    }

    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        userId: data.targetUserId,
        organizationId: data.organizationId,
        role: data.role,
      })
      .onConflictDoUpdate({
        target: [organizationMemberships.userId, organizationMemberships.organizationId],
        set: { role: data.role },
      })
      .returning()

    return membership
  })

export const inviteToBoard = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    inviterId: string
    targetUserId: string
    boardId: number
  }) => data)
  .handler(async ({ data }) => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, data.boardId),
    })
    if (!board) {
      throw new Error('Board not found')
    }

    const inviterMembership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.inviterId),
        eq(organizationMemberships.organizationId, board.organizationId)
      ),
    })
    if (inviterMembership?.role !== 'admin') {
      throw new Error('Only organization admins can invite users to boards')
    }

    const targetMembership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.targetUserId),
        eq(organizationMemberships.organizationId, board.organizationId)
      ),
    })
    if (!targetMembership) {
      await db.insert(organizationMemberships).values({
        userId: data.targetUserId,
        organizationId: board.organizationId,
        role: 'member',
      })
    }

    const [boardMembership] = await db
      .insert(boardMemberships)
      .values({
        userId: data.targetUserId,
        boardId: data.boardId,
      })
      .onConflictDoNothing()
      .returning()

    return boardMembership
  })

export const removeFromBoard = createServerFn({ method: 'POST' })
  .inputValidator((data: { adminId: string; targetUserId: string; boardId: number }) => data)
  .handler(async ({ data }) => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, data.boardId),
    })
    if (!board) throw new Error('Board not found')

    const adminMembership = await db.query.organizationMemberships.findFirst({
      where: and(
        eq(organizationMemberships.userId, data.adminId),
        eq(organizationMemberships.organizationId, board.organizationId)
      ),
    })
    if (adminMembership?.role !== 'admin') {
      throw new Error('Only organization admins can remove users from boards')
    }

    await db
      .delete(boardMemberships)
      .where(
        and(
          eq(boardMemberships.userId, data.targetUserId),
          eq(boardMemberships.boardId, data.boardId)
        )
      )

    return { success: true }
  })

// PUNCH FUNCTIONS (BOARD-SCOPED)

export const getPunchStatus = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number }) => data)
  .handler(async ({ data }) => {
    const lastPunch = await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          eq(punches.boardId, data.boardId)
        )
      )
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

export const punch = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    userId: string
    boardId: number
    userName?: string
    userEmail?: string
    type: 'in' | 'out'
  }) => data)
  .handler(async ({ data }) => {
    const [newPunch] = await db
      .insert(punches)
      .values({
        userId: data.userId,
        boardId: data.boardId,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        type: data.type,
        timestamp: new Date(),
      })
      .returning()

    return newPunch
  })

export const getTodayPunches = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number }) => data)
  .handler(async ({ data }) => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, today),
          lte(punches.timestamp, tomorrow)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

export const getPunchHistory = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.startDate)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(data.endDate)
    end.setUTCHours(23, 59, 59, 999)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

export const calculateHoursFromPunches = (punchList: { type: string; timestamp: Date }[]): number => {
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

export const getAllTodayPunches = createServerFn({ method: 'POST' })
  .inputValidator((boardId: number) => boardId)
  .handler(async ({ data: boardId }) => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.boardId, boardId),
          gte(punches.timestamp, today),
          lte(punches.timestamp, tomorrow)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

export const getAllUsersStatus = createServerFn({ method: 'POST' })
  .inputValidator((boardId: number) => boardId)
  .handler(async ({ data: boardId }) => {
    const latestPunches = await db
      .select()
      .from(punches)
      .where(eq(punches.boardId, boardId))
      .orderBy(desc(punches.timestamp))

    const userMap = new Map<string, (typeof latestPunches)[0]>()
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

export const getUserPunchHistory = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number; startDate: string; endDate: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.startDate)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(data.endDate)
    end.setUTCHours(23, 59, 59, 999)

    return await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(desc(punches.timestamp))
  })

export const getWeeklySummary = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number; weekStart: string }) => data)
  .handler(async ({ data }) => {
    const start = new Date(data.weekStart)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)

    const weekPunches = await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.userId, data.userId),
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

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

export const getAllUsersMonthlyStats = createServerFn({ method: 'POST' })
  .inputValidator((data: { boardId: number; month: string }) => data)
  .handler(async ({ data }) => {
    const [year, month] = data.month.split('-').map(Number)
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
    const end = new Date(year, month, 0, 23, 59, 59, 999)

    const monthPunches = await db
      .select()
      .from(punches)
      .where(
        and(
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

    const userPunchesMap = new Map<string, { 
      userId: string
      userName: string | null
      userEmail: string | null
      punchList: (typeof monthPunches)
    }>()

    for (const p of monthPunches) {
      if (!userPunchesMap.has(p.userId)) {
        userPunchesMap.set(p.userId, {
          userId: p.userId,
          userName: p.userName,
          userEmail: p.userEmail,
          punchList: [],
        })
      }
      userPunchesMap.get(p.userId)?.punchList.push(p)
    }

    return Array.from(userPunchesMap.values()).map(user => {
      const totalHours = calculateHoursFromPunches(user.punchList)
      const daysWorked = new Set(
        user.punchList.map(p => new Date(p.timestamp).toISOString().split('T')[0])
      ).size
      const punchCount = user.punchList.length

      return {
        userId: user.userId,
        userName: user.userName,
        userEmail: user.userEmail,
        totalHours,
        daysWorked,
        punchCount,
        avgHoursPerDay: daysWorked > 0 ? totalHours / daysWorked : 0,
      }
    }).sort((a, b) => b.totalHours - a.totalHours)
  })

export const getUserMonthlyBreakdown = createServerFn({ method: 'POST' })
  .inputValidator((data: { userId: string; boardId: number; month: string }) => data)
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
          eq(punches.boardId, data.boardId),
          gte(punches.timestamp, start),
          lte(punches.timestamp, end)
        )
      )
      .orderBy(punches.timestamp)

    const weeklyBreakdown: { weekStart: string; weekEnd: string; hours: number; days: number }[] = []
    
    const currentWeekStart = new Date(start)
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

export const deletePunch = createServerFn({ method: 'POST' })
  .inputValidator((punchId: number) => punchId)
  .handler(async ({ data: punchId }) => {
    await db.delete(punches).where(eq(punches.id, punchId))
    return { success: true }
  })

export const deletePunches = createServerFn({ method: 'POST' })
  .inputValidator((punchIds: number[]) => punchIds)
  .handler(async ({ data: punchIds }) => {
    if (punchIds.length === 0) return { success: true, deleted: 0 }
    await db.delete(punches).where(inArray(punches.id, punchIds))
    return { success: true, deleted: punchIds.length }
  })

export const addPunch = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    userId: string
    boardId: number
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
        boardId: data.boardId,
        userName: data.userName || null,
        userEmail: data.userEmail || null,
        type: data.type,
        timestamp: new Date(data.timestamp),
      })
      .returning()

    return newPunch
  })

export const getBoardMembers = createServerFn({ method: 'POST' })
  .inputValidator((boardId: number) => boardId)
  .handler(async ({ data: boardId }) => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.id, boardId),
    })
    if (!board) return []

    const orgMembers = await db.query.organizationMemberships.findMany({
      where: eq(organizationMemberships.organizationId, board.organizationId),
      with: {
        user: true,
      },
    })

    const boardMembersList = await db.query.boardMemberships.findMany({
      where: eq(boardMemberships.boardId, boardId),
    })
    const boardMemberIds = new Set(boardMembersList.map(m => m.userId))

    return orgMembers.map(m => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      orgRole: m.role,
      hasBoardAccess: m.role === 'admin' || boardMemberIds.has(m.userId),
    }))
  })

export const getOrganizationMembers = createServerFn({ method: 'POST' })
  .inputValidator((organizationId: number) => organizationId)
  .handler(async ({ data: organizationId }) => {
    const orgMembers = await db.query.organizationMemberships.findMany({
      where: eq(organizationMemberships.organizationId, organizationId),
      with: {
        user: true,
      },
    })

    return orgMembers.map(m => ({
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
    }))
  })
