import { relations } from 'drizzle-orm'
import { integer, pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core'

// Users table - stores user info and global roles
export const users = pgTable('users', {
  userId: varchar('user_id', { length: 255 }).primaryKey(), // Clerk user ID
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  globalRole: varchar('global_role', { length: 20 }).notNull().default('user'), // 'superadmin' | 'user'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const usersRelations = relations(users, ({ many }) => ({
  organizationMemberships: many(organizationMemberships),
  boardMemberships: many(boardMemberships),
  punches: many(punches),
}))

// Organizations table
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const organizationsRelations = relations(organizations, ({ many }) => ({
  boards: many(boards),
  memberships: many(organizationMemberships),
}))

// Boards table - each org can have multiple boards
export const boards = pgTable('boards', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('boards_org_slug_unique').on(table.organizationId, table.slug),
])

export const boardsRelations = relations(boards, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [boards.organizationId],
    references: [organizations.id],
  }),
  memberships: many(boardMemberships),
  punches: many(punches),
}))

// Organization memberships - user's role within an org
export const organizationMemberships = pgTable('organization_memberships', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.userId),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  role: varchar('role', { length: 20 }).notNull().default('member'), // 'admin' | 'member'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('org_memberships_user_org_unique').on(table.userId, table.organizationId),
])

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  user: one(users, {
    fields: [organizationMemberships.userId],
    references: [users.userId],
  }),
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
}))

// Board memberships - which boards a non-admin user has access to
export const boardMemberships = pgTable('board_memberships', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => users.userId),
  boardId: integer('board_id').notNull().references(() => boards.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  unique('board_memberships_user_board_unique').on(table.userId, table.boardId),
])

export const boardMembershipsRelations = relations(boardMemberships, ({ one }) => ({
  user: one(users, {
    fields: [boardMemberships.userId],
    references: [users.userId],
  }),
  board: one(boards, {
    fields: [boardMemberships.boardId],
    references: [boards.id],
  }),
}))

// Punch records - each row is a clock-in or clock-out event
export const punches = pgTable('punches', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(), // Clerk user ID
  boardId: integer('board_id').references(() => boards.id), // Will be made NOT NULL after migration
  userName: varchar('user_name', { length: 255 }), // Cached user name for admin display
  userEmail: varchar('user_email', { length: 255 }), // Cached email for admin display
  type: varchar('type', { length: 10 }).notNull(), // 'in' or 'out'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  notes: varchar("notes", {length: 255}),
})

export const punchesRelations = relations(punches, ({ one }) => ({
  board: one(boards, {
    fields: [punches.boardId],
    references: [boards.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

export type Board = typeof boards.$inferSelect
export type NewBoard = typeof boards.$inferInsert

export type OrganizationMembership = typeof organizationMemberships.$inferSelect
export type NewOrganizationMembership = typeof organizationMemberships.$inferInsert

export type BoardMembership = typeof boardMemberships.$inferSelect
export type NewBoardMembership = typeof boardMemberships.$inferInsert

export type Punch = typeof punches.$inferSelect
export type NewPunch = typeof punches.$inferInsert
