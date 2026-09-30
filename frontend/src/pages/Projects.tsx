import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
  const [createOpen, setCreateOpen] = useState(false)
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
        setCreateOpen(false)
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Create project</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create project</DialogTitle>
              <DialogDescription>
                Give the project a name and a unique lowercase slug. New projects use closed
                enrollment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-4">
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
          </DialogContent>
        </Dialog>
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && (
          <Table aria-label="Projects">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Enrollment</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resource.data.data.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      to={'/projects/' + project.id + '/overview'}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{project.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{project.enrollmentPolicy}</Badge>
                  </TableCell>
                  <TableCell>{project._count?.memberships ?? 0}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {!resource.data.data.length && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No projects yet. Create a project to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
