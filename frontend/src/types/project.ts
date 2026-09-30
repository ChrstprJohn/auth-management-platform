export interface Project {
  id: string
  slug: string
  name: string
  description: string | null
  enrollmentPolicy: 'open' | 'closed'
  createdAt: string
  updatedAt: string
  _count?: { memberships: number }
}
