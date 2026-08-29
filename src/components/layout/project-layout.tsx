import { Outlet, useParams } from 'react-router-dom'
import { Topbar } from '@/components/layout/topbar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MOCK_PROJECTS } from '@/types/project'

/**
 * Shell used when the user is inside a specific project.
 * Renders: Topbar (with project breadcrumb) + sidebar + content area.
 */
export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = MOCK_PROJECTS.find((p) => p.appId === projectId)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Topbar breadcrumb={project?.name ?? projectId} />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
