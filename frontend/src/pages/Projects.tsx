import { useAction } from '@/hooks/use-action'
import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi } from '@/services/admin-api'
import { useResource } from '@/hooks/use-resource'
import { ResourceState } from '@/components/common/resource-state'
export function ProjectsPage() {
  const [cursor, setCursor] = useState<string>()
  const load = useCallback(() => adminApi.projects(cursor), [cursor])
  const resource = useResource(load)
  const [name, setName] = useState(''),
    [slug, setSlug] = useState('')
  const { busy, error, perform } = useAction()
  async function create(event: FormEvent) {
    event.preventDefault()
    await perform(
      () => adminApi.createProject({ name, slug }),
      () => {
        setName('')
        setSlug('')
        setCursor(undefined)
        resource.reload()
      }
    )
  }
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8">
        <header>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-2 text-muted-foreground">Manage project membership and enrollment.</p>
        </header>
        <form onSubmit={create} className="flex flex-wrap items-end gap-4 border-b pb-6">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-slug">Slug</Label>
            <Input
              id="project-slug"
              required
              maxLength={63}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create project'}</Button>
          {error && (
            <p role="alert" className="w-full text-destructive">
              {error}
            </p>
          )}
        </form>
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && (
          <div className="divide-y">
            {resource.data.data.length ? (
              resource.data.data.map((project) => (
                <Link
                  key={project.id}
                  to={'/projects/' + project.id + '/overview'}
                  className="flex items-center justify-between gap-4 py-5 hover:text-primary"
                >
                  <div className="min-w-0">
                    <h2 className="font-semibold break-words">{project.name}</h2>
                    <p className="text-sm text-muted-foreground">{project.slug}</p>
                  </div>
                  <span className="shrink-0 text-sm">
                    {project._count?.memberships ?? 0} members →
                  </span>
                </Link>
              ))
            ) : (
              <p className="py-8 text-muted-foreground">
                No projects yet. Create your first project above.
              </p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          {cursor && (
            <Button variant="outline" onClick={() => setCursor(undefined)}>
              First page
            </Button>
          )}
          {resource.data?.nextCursor && (
            <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
              Next page
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
