import { useAction } from '@/hooks/use-action'
import { useCallback, useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ResourceState } from '@/components/common/resource-state'
import { Pagination } from '@/components/common/pagination'
import { useResource } from '@/hooks/use-resource'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { adminApi } from '@/services/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function GlobalUsersPage() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState('')
  const load = useCallback(() => adminApi.users(page), [page])
  const resource = useResource(load)
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('')
  const { busy, error, perform } = useAction()
  async function create(event: FormEvent) {
    event.preventDefault()
    await perform(
      () => adminApi.createUser({ email, password }),
      () => {
        setEmail('')
        setPassword('')
        resource.reload()
      }
    )
  }
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
        <form onSubmit={create} className="flex flex-wrap items-end gap-4 border-b pb-6">
          <div className="space-y-2">
            <Label htmlFor="new-account-email">Email</Label>
            <Input
              id="new-account-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-account-password">Password</Label>
            <Input
              id="new-account-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        </form>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
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
          <ul className="divide-y">
            {resource.data.data
              .filter((user) =>
                (user.email ?? user.id).toLowerCase().includes(search.toLowerCase())
              )
              .map((user) => (
                <li key={user.id} className="py-4">
                  <Link className="break-all text-primary underline" to={'/users/' + user.id}>
                    {user.email ?? user.id}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {user.email_confirmed_at ? 'Confirmed' : 'Pending confirmation'}
                  </p>
                </li>
              ))}
            {!resource.data.data.length && (
              <li className="py-8 text-muted-foreground">No accounts found.</li>
            )}
          </ul>
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
