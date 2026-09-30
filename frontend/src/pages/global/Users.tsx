import { useCallback, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ResourceState } from '@/components/common/resource-state'
import { Pagination } from '@/components/common/pagination'
import { useResource } from '@/hooks/use-resource'
import { Link } from 'react-router-dom'
import { adminApi } from '@/services/admin-api'
import { CreateAccountDialog } from '@/components/common/create-account-dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function GlobalUsersPage() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState('')
  const load = useCallback(() => adminApi.users(page), [page])
  const resource = useResource(load)
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <header>
          <h1 className="text-2xl font-semibold">Global accounts</h1>
          <p className="mt-2 text-muted-foreground">
            Shared GoTrue identities across all projects. New accounts are not enrolled
            automatically.
          </p>
        </header>
        <CreateAccountDialog onCreated={resource.reload} />
        <div className="space-y-2">
          <Label htmlFor="global-search">Search this page</Label>
          <Input
            id="global-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && (
          <Table aria-label="Global accounts">
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resource.data.data
                .filter((user) =>
                  (user.email ?? user.id).toLowerCase().includes(search.toLowerCase())
                )
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:text-primary hover:underline"
                        to={'/users/' + user.id}
                      >
                        {user.email ?? user.id}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{user.id}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {user.disabled
                          ? 'Disabled'
                          : user.email_confirmed_at
                            ? 'Confirmed'
                            : 'Pending confirmation'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : 'Unavailable'}
                    </TableCell>
                  </TableRow>
                ))}
              {!resource.data.data.some((user) =>
                (user.email ?? user.id).toLowerCase().includes(search.toLowerCase())
              ) && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                    {search ? 'No matching accounts on this page.' : 'No accounts yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <Pagination
          page={page}
          hasMore={Boolean(resource.data?.hasMore)}
          disabled={resource.loading}
          onChange={setPage}
        />
      </div>
    </DashboardLayout>
  )
}
