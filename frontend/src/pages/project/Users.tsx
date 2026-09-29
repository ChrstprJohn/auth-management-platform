import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, UserPlus, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface MockUser {
  id: string
  email: string
  status: 'Verified' | 'Pending'
  created: string
}

const MOCK_USERS: MockUser[] = [
  { id: '81f0e673-1a2b-4c3d-8e9f-0a1b2c3d4e5f', email: 'john@email.com', status: 'Verified', created: 'Aug 29' },
  { id: '22b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d', email: 'jane@email.com', status: 'Pending', created: 'Aug 28' },
  { id: '33c4d5e6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', email: 'mike@email.com', status: 'Verified', created: 'Aug 27' },
  { id: '44d5e6f7-8a9b-0c1d-2e3f-4a5b6c7d8e9f', email: 'sara@email.com', status: 'Verified', created: 'Aug 26' },
  { id: '55e6f7a8-9b0c-1d2e-3f4a-5b6c7d8e9f0a', email: 'alex@email.com', status: 'Pending', created: 'Aug 25' },
]

export function UsersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Verified' | 'Pending'>('All')

  const filtered = MOCK_USERS.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || u.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Identity</p>
          <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All users registered under this project.
          </p>
        </div>
        <Button
          id="add-user-btn"
          type="button"
          size="sm"
        >
          <UserPlus size={13} />
          Add User
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="user-search"
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
          <SlidersHorizontal size={14} className="ml-1.5 text-muted-foreground" />
          {(['All', 'Verified', 'Pending'] as const).map((f) => (
          <Button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            variant={statusFilter === f ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'text-xs',
              statusFilter === f
                ? 'bg-background shadow-xs'
                : 'text-muted-foreground'
            )}
          >
            {f}
          </Button>
        ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Email</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</th>
              <th className="px-5 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No users found.
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/projects/${projectId}/users/${user.id}`)}
                >
                  <td className="px-5 py-3 font-medium">{user.email}</td>
                  <td className="px-5 py-3">
                    <Badge variant={user.status === 'Verified' ? 'success' : 'warning'}>{user.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{user.created}</td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      type="button"
                      onClick={(e) => { e.stopPropagation() /* TODO: actions menu */ }}
                      variant="ghost"
                      size="icon-xs"
                      aria-label="User actions"
                    >
                      <MoreHorizontal size={14} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
