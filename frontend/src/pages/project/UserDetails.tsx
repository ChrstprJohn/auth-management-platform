import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useOutletContext } from 'react-router-dom'
import { adminApi } from '@/services/admin-api'
import type { Project } from '@/types/project'
import { useResource } from '@/hooks/use-resource'
import { useAction } from '@/hooks/use-action'
import { ResourceState } from '@/components/common/resource-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function UserDetailsPage() {
  const context = useOutletContext<{ project: Project } | undefined>()
  const project = context?.project
  const { userId = '' } = useParams()
  const navigate = useNavigate()
  const load = useCallback(() => adminApi.user(userId), [userId])
  const resource = useResource(load)
  const [role, setRole] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notice, setNotice] = useState('')
  const { busy, error, perform } = useAction()
  async function action(run: () => Promise<unknown>, leave = false) {
    setNotice('')
    await perform(run, () => {
      if (leave) navigate(project ? '/projects/' + project.id + '/users' : '/users')
      else resource.reload()
    })
  }
  function update(event: FormEvent) {
    event.preventDefault()
    void action(() =>
      adminApi
        .updateUser(userId, { ...(email ? { email } : {}), ...(password ? { password } : {}) })
        .then((result) => {
          setPassword('')
          setEmail('')
          return result
        })
    )
  }
  const user = resource.data?.data
  const membership = user?.memberships?.find((row) => row.projectId === project?.id)
  const selectedRole = role || membership?.role || 'member'
  const disabled = Boolean(user?.disabled)
  return (
    <div className="max-w-2xl space-y-6">
      <Link
        to={project ? '/projects/' + project.id + '/users' : '/users'}
        className="text-primary underline"
      >
        Back to {project ? 'members' : 'accounts'}
      </Link>
      <ResourceState {...resource} retry={resource.reload} />
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-muted-foreground">
          {notice}
        </p>
      )}
      {user && (
        <>
          <header>
            <h1 className="break-all text-2xl font-semibold">{user.email ?? user.id}</h1>
            <p className="mt-2 text-muted-foreground">
              {user.email_confirmed_at ? 'Email confirmed' : 'Email not confirmed'}
            </p>
          </header>
          <dl className="space-y-3 border-y py-5">
            <div>
              <dt className="text-muted-foreground">User UUID</dt>
              <dd className="break-all">{user.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>
                {user.created_at ? new Date(user.created_at).toLocaleString() : 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last login</dt>
              <dd>
                {user.last_sign_in_at
                  ? new Date(user.last_sign_in_at).toLocaleString()
                  : 'No login recorded'}
              </dd>
            </div>
          </dl>
          {project && (
            <section className="space-y-3">
              <h2 className="font-semibold">Membership in {project.name}</h2>
              <p>Current role: {membership?.role ?? 'No membership'}</p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Edit membership</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit project membership</DialogTitle>
                    <DialogDescription>
                      Change access to {project.name}. The shared account remains if membership is
                      removed.
                    </DialogDescription>
                  </DialogHeader>
                  <Label htmlFor="detail-role">Assign role</Label>
                  <Select value={selectedRole} onValueChange={(value) => setRole(value)}>
                    <SelectTrigger id="detail-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(() => adminApi.assign(project.id, userId, selectedRole))
                      }
                    >
                      Save membership
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || !membership}
                      onClick={() => void action(() => adminApi.remove(project.id, userId), true)}
                    >
                      Remove membership
                    </Button>
                  </div>
                  {error && (
                    <p role="alert" className="text-destructive">
                      {error}
                    </p>
                  )}
                </DialogContent>
              </Dialog>
            </section>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Edit account</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit shared account</DialogTitle>
                <DialogDescription>
                  Changes to email and password apply across every project.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={update} className="space-y-3 border-t pt-5">
                <p className="text-sm text-muted-foreground">
                  These changes apply across all projects.
                </p>
                <Label htmlFor="detail-email">New email</Label>
                <Input
                  id="detail-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Label htmlFor="detail-password">New password</Label>
                <Input
                  id="detail-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy || (!email && !password)}>Update account</Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || Boolean(user.email_confirmed_at)}
                    onClick={() =>
                      void action(() => adminApi.updateUser(userId, { email_confirm: true }))
                    }
                  >
                    Confirm email
                  </Button>
                </div>
                {error && (
                  <p role="alert" className="text-destructive">
                    {error}
                  </p>
                )}
              </form>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Access and recovery</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Account access and recovery</DialogTitle>
                <DialogDescription>
                  Manage sign-in access and request a recovery email. These actions affect the
                  shared account.
                </DialogDescription>
              </DialogHeader>
              <section className="space-y-3 border-t pt-5">
                <p className="text-sm text-muted-foreground">
                  Disabling affects every project. Recovery requires working GoTrue email delivery.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void action(() => adminApi.updateUser(userId, { disabled: !disabled }))
                    }
                  >
                    {disabled ? 'Enable account' : 'Disable account'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void action(() =>
                        adminApi.recoverUser(userId).then((result) => {
                          setNotice(result.data.message)
                        })
                      )
                    }
                  >
                    Send recovery email
                  </Button>
                </div>
              </section>
            </DialogContent>
          </Dialog>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">Delete account</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Delete shared account</DialogTitle>
                <DialogDescription>
                  This removes the account and its memberships across every project.
                </DialogDescription>
              </DialogHeader>
              <section className="space-y-3 border-t pt-5">
                <p className="text-sm text-muted-foreground">
                  Removes the GoTrue account and membership across every project. Revoke dashboard
                  admin status first. Type the user UUID to confirm.
                </p>
                <Label htmlFor="account-confirm">User UUID confirmation</Label>
                <Input
                  id="account-confirm"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                <Button
                  variant="destructive"
                  disabled={busy || confirmation !== userId}
                  onClick={() => void action(() => adminApi.deleteUser(userId), true)}
                >
                  Delete account everywhere
                </Button>
              </section>
              {error && (
                <p role="alert" className="text-destructive">
                  {error}
                </p>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
