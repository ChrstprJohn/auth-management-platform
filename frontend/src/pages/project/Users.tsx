import { useAction } from '@/hooks/use-action'
import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useProject } from '@/hooks/use-project'
import { useResource } from '@/hooks/use-resource'
import { adminApi } from '@/services/admin-api'
import { ResourceState } from '@/components/common/resource-state'
import { Pagination } from '@/components/common/pagination'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function UsersPage() {
  const { project } = useProject()
  const [page, setPage] = useState(1)
  const load = useCallback(() => adminApi.members(project.id, page), [project.id, page])
  const resource = useResource(load)
  const [userId, setUserId] = useState(''),
    [role, setRole] = useState('member')
  const [search, setSearch] = useState('')
  const { busy, error, perform } = useAction()
  async function assign(event: FormEvent) {
    event.preventDefault()
    await perform(
      () => adminApi.assign(project.id, userId.trim(), role),
      () => {
        setUserId('')
        resource.reload()
      }
    )
  }
  const rows = resource.data?.data.filter((member) =>
    (member.user?.email ?? member.gotrueUserId).toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Project members</h1>
        <p className="mt-2 text-muted-foreground">
          Assign existing accounts to {project.name}. Removing membership does not delete the
          account.
        </p>
      </header>
      <form onSubmit={assign} className="flex flex-wrap items-end gap-4 border-b pb-6">
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="member-id">GoTrue user UUID</Label>
          <Input
            id="member-id"
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-role">Role</Label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="block rounded-md border bg-background p-2"
          >
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </select>
        </div>
        <Button disabled={busy}>{busy ? 'Assigning…' : 'Assign membership'}</Button>
      </form>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="member-search">Search this page</Label>
        <Input
          id="member-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {rows && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Account</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.gotrueUserId} className="border-b">
                  <td className="p-3">
                    <Link
                      className="text-primary underline underline-offset-4"
                      to={'/projects/' + project.id + '/users/' + member.gotrueUserId}
                    >
                      {member.user?.email ?? member.gotrueUserId}
                    </Link>
                    {!member.user && (
                      <span className="ml-2 text-muted-foreground">Account missing</span>
                    )}
                  </td>
                  <td className="p-3">{member.role}</td>
                  <td className="p-3">{new Date(member.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-8 text-muted-foreground">No members found.</p>}
        </div>
      )}
      <Pagination
        page={page}
        hasMore={Boolean(resource.data?.hasMore)}
        disabled={resource.loading}
        onChange={setPage}
      />
    </div>
  )
}
