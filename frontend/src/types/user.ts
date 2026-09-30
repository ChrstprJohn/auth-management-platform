import type { Project } from './project'
export interface User {
  id: string
  email?: string
  created_at?: string
  email_confirmed_at?: string | null
  last_sign_in_at?: string | null
  banned_until?: string | null
  disabled?: boolean
  memberships?: Membership[]
}
export interface Membership {
  projectId: string
  gotrueUserId: string
  role: 'member' | 'manager'
  createdAt: string
  user?: User | null
  project?: Project
}
export interface Page<T> {
  data: T[]
  page: number
  hasMore: boolean
}
