import { useState } from 'react'
import { adminApi } from '@/services/admin-api'
import { useAction } from '@/hooks/use-action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function CreateAccountDialog({
  project,
  onCreated,
}: {
  project?: { id: string; name: string }
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [createdId, setCreatedId] = useState('')
  const { busy, error, perform } = useAction()
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) setOpen(value)
      }}
    >
      <DialogTrigger asChild>
        <Button>Create account</Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
        onInteractOutside={(e) => {
          if (busy || createdId) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{project ? 'Create project account' : 'Create shared account'}</DialogTitle>
          <DialogDescription>
            {project
              ? `Create a GoTrue account and add it to ${project.name} as a member. This works with closed enrollment too.`
              : 'Create a GoTrue identity. You can assign it to projects afterward.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void perform(
              async () => {
                let id = createdId
                if (!id) {
                  const result = await adminApi.createUser({
                    email,
                    password,
                    email_confirm: confirmed,
                  })
                  id = result.data.id
                  setCreatedId(id)
                  setPassword('')
                }
                if (project) await adminApi.assign(project.id, id, 'member')
              },
              () => {
                setOpen(false)
                setEmail('')
                setPassword('')
                setCreatedId('')
                setConfirmed(false)
                onCreated()
              }
            )
          }}
        >
          {createdId ? (
            <p role="status" className="rounded-lg bg-muted p-3 text-sm">
              Account created: <span className="break-all font-mono">{createdId}</span>
              {project &&
                '. Assignment is pending. Retry to add this account without creating another.'}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Initial password</Label>
                <Input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Use 12–128 characters.</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="create-confirmed">Mark email as confirmed</Label>
                <Switch
                  id="create-confirmed"
                  checked={confirmed}
                  onCheckedChange={setConfirmed}
                  disabled={busy}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Only confirm an address you have verified. Leaving this off may require email
                confirmation before sign-in.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button disabled={busy}>
              {busy
                ? 'Saving…'
                : createdId
                  ? 'Retry assignment'
                  : project
                    ? 'Create and add member'
                    : 'Create account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
