export interface NewProject {
  slug: string
  name: string
  description: string | null
  enrollmentPolicy?: 'open' | 'closed'
}
