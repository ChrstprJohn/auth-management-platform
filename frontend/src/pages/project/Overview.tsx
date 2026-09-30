import { Link } from 'react-router-dom'
import { useProject } from '@/hooks/use-project'
export function OverviewPage() {
  const { project } = useProject()
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {project.description || 'No description provided.'}
        </p>
      </header>
      <dl className="grid gap-5 border-y py-6 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Members</dt>
          <dd className="mt-1 text-xl">{project._count?.memberships ?? 0}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Enrollment</dt>
          <dd className="mt-1 capitalize">{project.enrollmentPolicy}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Project slug</dt>
          <dd className="mt-1">{project.slug}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd className="mt-1">{new Date(project.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>
      <Link
        className="text-primary underline underline-offset-4"
        to={'/projects/' + project.id + '/users'}
      >
        Manage project members
      </Link>
    </div>
  )
}
