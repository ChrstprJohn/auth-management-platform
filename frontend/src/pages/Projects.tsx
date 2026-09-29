import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProjectCard } from '@/components/projects/project-card'
import { MOCK_PROJECTS } from '@/types/project'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ProjectsPage() {
  const navigate = useNavigate()

  const newProjectButton = (
    <Button
      id="new-project-btn"
      type="button"
      onClick={() => {/* TODO Phase 6 */}}
      size="sm"
    >
      <Plus size={13} />
      New Project
    </Button>
  )

  return (
    <DashboardLayout action={newProjectButton}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Workspace</p>
          <h2 className="text-2xl font-semibold tracking-tight">Your Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a project to manage its users and settings.
          </p>
        </div>

        {MOCK_PROJECTS.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <Button
              type="button"
              variant="link"
              className="mt-3"
            >
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MOCK_PROJECTS.map((project) => (
              <ProjectCard
                key={project.appId}
                project={project}
                onSelect={() => navigate(`/projects/${project.appId}/overview`)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
