import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Clock, Trash2, Ban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MOCK_USER_MAP: Record<string, {
  email: string
  status: 'Verified' | 'Pending'
  id: string
  created: string
  lastSignIn: string
  metadata: Record<string, unknown>
}> = {
  '81f0e673-1a2b-4c3d-8e9f-0a1b2c3d4e5f': {
    email: 'john@email.com',
    status: 'Verified',
    id: '81f0e673-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
    created: 'Aug 29, 2026',
    lastSignIn: 'Aug 29, 2026',
    metadata: { app_id: 'crm' },
  },
  '22b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d': {
    email: 'jane@email.com',
    status: 'Pending',
    id: '22b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d',
    created: 'Aug 28, 2026',
    lastSignIn: 'Aug 28, 2026',
    metadata: { app_id: 'crm' },
  },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function UserDetailsPage() {
  const { projectId, userId } = useParams<{ projectId: string; userId: string }>()
  const navigate = useNavigate()
  const user = userId ? MOCK_USER_MAP[userId] : null

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <p className="text-sm text-muted-foreground">User not found.</p>
        <Button
          type="button"
          onClick={() => navigate(`/projects/${projectId}/users`)}
          variant="link"
        >
          Back to Users
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <Button
        type="button"
        onClick={() => navigate(`/projects/${projectId}/users`)}
        variant="ghost" size="sm" className="w-fit text-muted-foreground"
      >
        <ArrowLeft size={13} />
        Back to Users
      </Button>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">User profile</p>
        <h2 className="text-2xl font-semibold tracking-tight">{user.email}</h2>
        <div className="flex items-center gap-1.5 mt-1.5">
          {user.status === 'Verified' ? (
            <ShieldCheck size={13} className="text-green-600" />
          ) : (
            <Clock size={13} className="text-yellow-600" />
          )}
          <Badge variant={user.status === 'Verified' ? 'success' : 'warning'}>Email {user.status === 'Verified' ? 'verified' : 'not verified'}</Badge>
        </div>
      </div>

      <Card><CardContent className="space-y-5 p-6">
        <Field label="User ID">
          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{user.id}</code>
        </Field>
        <Field label="Created">{user.created}</Field>
        <Field label="Last Sign In">{user.lastSignIn}</Field>
        <Field label="Metadata">
          <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto">
            {JSON.stringify(user.metadata, null, 2)}
          </pre>
        </Field>
      </CardContent></Card>

      {/* Actions */}
      <Card className="border-destructive/25"><CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex gap-3">
          <Button
            id="disable-user-btn"
            type="button"
            variant="outline" size="sm"
          >
            <Ban size={13} />
            Disable User
          </Button>
          <Button
            id="delete-user-btn"
            type="button"
            variant="destructive" size="sm"
          >
            <Trash2 size={13} />
            Delete User
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Dangerous operations will be connected to the admin API in Phase 6.
        </p>
      </CardContent></Card>
    </div>
  )
}
