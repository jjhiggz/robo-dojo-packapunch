import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core'

// Punch records - each row is a clock-in or clock-out event
export const punches = pgTable('punches', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(), // Clerk user ID
  userName: varchar('user_name', { length: 255 }), // Cached user name for admin display
  userEmail: varchar('user_email', { length: 255 }), // Cached email for admin display
  type: varchar('type', { length: 10 }).notNull(), // 'in' or 'out'
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

export type Punch = typeof punches.$inferSelect
export type NewPunch = typeof punches.$inferInsert
