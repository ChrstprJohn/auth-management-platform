export interface Project {
  name: string
  users: number
  appId: string
}

/** Mock projects — replace with real API data in Phase 6 */
export const MOCK_PROJECTS: Project[] = [
  { name: 'CRM', users: 124, appId: 'crm' },
  { name: 'Dental Website', users: 38, appId: 'dental' },
  { name: 'Portfolio', users: 8, appId: 'portfolio' },
]
