export interface AuthUser {
  id: string
  email?: string
  created_at?: string
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
  banned_until?: string | null
  disabled?: boolean
}
