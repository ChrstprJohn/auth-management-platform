import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
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
import { CreateAccountDialog } from '@/components/common/create-account-dialog'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
export function UsersPage() {
  const { project } = useProject()
  const [page, setPage] = useState(1)
  const [assignOpen, setAssignOpen] = useState(false)
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
        setAssignOpen(false)
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
      <div className="flex flex-wrap gap-3">
        <CreateAccountDialog project={project} onCreated={resource.reload} />
        <Dialog
          open={assignOpen}
          onOpenChange={(open) => {
            if (!busy) setAssignOpen(open)
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline">Assign existing account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign existing account</DialogTitle>
              <DialogDescription>
                Add an existing GoTrue identity to {project.name}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={assign} className="space-y-4">
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
                <Select value={role} onValueChange={(value) => setRole(value)}>
                  <SelectTrigger id="member-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={busy}>{busy ? 'Assigning…' : 'Assign membership'}</Button>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>
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
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="p-3 text-left">Account</TableHead>
                <TableHead className="p-3 text-left">Role</TableHead>
                <TableHead className="p-3 text-left">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((member) => (
                <TableRow key={member.gotrueUserId} className="border-b">
                  <TableCell className="p-3">
                    <Link
                      className="font-medium hover:text-primary hover:underline underline-offset-4"
                      to={'/projects/' + project.id + '/users/' + member.gotrueUserId}
                    >
                      {member.user?.email ?? member.gotrueUserId}
                    </Link>
                    {!member.user && (
                      <span className="ml-2 text-muted-foreground">Account missing</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{member.role}</Badge>
                  </TableCell>
                  <TableCell className="p-3">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
