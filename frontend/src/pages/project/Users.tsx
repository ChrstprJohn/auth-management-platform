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
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
export function UsersPage() {
  const { project, reload: reloadProject } = useProject()
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
        reloadProject()
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
          Create accounts or assign existing identities to {project.name}. Removing membership keeps
          the shared account.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <CreateAccountDialog
          key={project.id}
          project={project}
          onCreated={() => {
            resource.reload()
            reloadProject()
          }}
        />
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
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="member-search">Search this page</Label>
            <Input
              id="member-search"
              type="search"
              placeholder="Search email or user ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="px-4">
            <ResourceState {...resource} retry={resource.reload} />
          </div>
          {rows && (
            <Table aria-label="Project members">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">Account</TableHead>
                  <TableHead className="px-4">Role</TableHead>
                  <TableHead className="px-4">Joined</TableHead>
                  <TableHead className="px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((member) => (
                  <TableRow key={member.gotrueUserId}>
                    <TableCell className="px-4 py-3">
                      <Link
                        className="font-medium hover:text-primary hover:underline underline-offset-4"
                        to={'/projects/' + project.id + '/users/' + member.gotrueUserId}
                      >
                        {member.user?.email ?? member.gotrueUserId}
                      </Link>
                      {!member.user && (
                        <Badge variant="outline" className="ml-2">
                          Account missing
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary">{member.role}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 tabular-nums">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              'Actions for ' + (member.user?.email ?? member.gotrueUserId)
                            }
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={'/projects/' + project.id + '/users/' + member.gotrueUserId}>
                              View member details
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Pagination
            page={page}
            hasMore={Boolean(resource.data?.hasMore)}
            disabled={resource.loading}
            onChange={setPage}
          />
        </CardFooter>
      </Card>
    </div>
  )
}
