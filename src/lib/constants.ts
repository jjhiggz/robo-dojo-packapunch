// Admin email addresses - single source of truth for admin privileges
export const ADMIN_EMAILS: readonly string[] = [
  'jonathan.higger@gmail.com',
  'aionfork@gmail.com',
  'armstrong.dan237@gmail.com',
  'tarheelwinetraders@gmail.com',
  'janyoumd@gmail.com',
  'semoyer@vt.edu',
] as const

export const isAdminEmail = (email: string | undefined): boolean =>
  email !== undefined && (ADMIN_EMAILS as readonly string[]).includes(email)

