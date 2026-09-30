import { useCallback } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { Topbar } from './topbar'
import { AppSidebar } from './app-sidebar'
import { adminApi } from '@/services/admin-api'
import { useResource } from '@/hooks/use-resource'
import { ResourceState } from '@/components/common/resource-state'
export function ProjectLayout() {
  const { projectId = '' } = useParams()
  const load = useCallback(() => adminApi.project(projectId), [projectId])
  const resource = useResource(load)
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Topbar breadcrumb={resource.data?.data.name} />
      <div className="flex flex-1 flex-col md:flex-row">
        <AppSidebar name={resource.data?.data.name ?? 'Project'} />
        <main className="min-w-0 flex-1 p-5 sm:p-8">
          <ResourceState {...resource} retry={resource.reload} />
          {resource.data && (
            <Outlet context={{ project: resource.data.data, reload: resource.reload }} />
          )}
        </main>
      </div>
    </div>
  )
}
