// src/lib/auth.ts — v9 Fixed
// Permission levels match the DB CHECK constraint in user_permissions.access_level

export type PermLevel = 
  | 'none' 
  | 'submit_only' 
  | 'view_own' 
  | 'view_all'
  | 'view_with_details'
  | 'report_view'
  | 'report_with_details'
  | 'full_control'

export interface UserPayload {
  id:          string
  username:    string
  email:       string
  full_name:   string
  role:        string
  department?: string
  permissions: Record<string, string>
}

export function isSuperUser(user: UserPayload | null | undefined): boolean {
  if (!user) return false
  return (user.role as string) === 'superuser'
}

export function getPermLevel(user: UserPayload | null | undefined, module: string): PermLevel {
  if (!user) return 'none'
  if (isSuperUser(user)) return 'full_control'
  return (user.permissions?.[module] as PermLevel | undefined) ?? 'none'
}

export function canView(user: UserPayload | null | undefined, module: string): boolean {
  const level = getPermLevel(user, module)
  return level !== 'none' && level !== 'submit_only'
}

export function canSubmit(user: UserPayload | null | undefined, module: string): boolean {
  if (isSuperUser(user)) return true
  const level = getPermLevel(user, module)
  return level !== 'none'
}

export function canFullControl(user: UserPayload | null | undefined, module: string): boolean {
  if (isSuperUser(user)) return true
  return getPermLevel(user, module) === 'full_control'
}
