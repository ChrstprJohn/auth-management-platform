import type { ReactNode } from 'react'
import { Topbar } from '@/components/layout/topbar'

interface DashboardLayoutProps {
  children: ReactNode
  /** Optional page-level action shown in the topbar (e.g. "+ New Project" button) */
  action?: ReactNode
}

/**
 * Top-level shell used for full-page dashboard views (e.g. the Projects list).
 * Does NOT include a sidebar — sidebar is handled per project in ProjectLayout.
 */
export function DashboardLayout({ children, action }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Topbar action={action} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}