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
import { useAction } from '@/hooks/use-action'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/use-project'
import { adminApi } from '@/services/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
export function SettingsPage() {
  const { project, reload } = useProject()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name),
    [slug, setSlug] = useState(project.slug)
  const [description, setDescription] = useState(project.description ?? '')
  const [policy, setPolicy] = useState(project.enrollmentPolicy)
  const [confirmation, setConfirmation] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const { busy, error: message, perform } = useAction()
  async function save(event: FormEvent) {
    event.preventDefault()
    await perform(
      () =>
        adminApi.updateProject(project.id, { name, slug, description, enrollmentPolicy: policy }),
      () => {
        reload()
        setEditOpen(false)
      }
    )
  }
  async function remove() {
    await perform(
      () => adminApi.deleteProject(project.id),
      () => navigate('/projects')
    )
  }
  return (
    <div className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold">Project settings</h1>
      <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">Name</dt>
          <dd className="mt-1 font-medium">{project.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Slug</dt>
          <dd className="mt-1">{project.slug}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Enrollment</dt>
          <dd className="mt-1 capitalize">{project.enrollmentPolicy}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Description</dt>
          <dd className="mt-1">{project.description || 'No description'}</dd>
        </div>
      </dl>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">Edit settings</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project settings</DialogTitle>
            <DialogDescription>Update project details and enrollment policy.</DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-slug">Slug</Label>
              <Input
                id="settings-slug"
                required
                maxLength={63}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-description">Description</Label>
              <Textarea
                id="settings-description"
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-policy">Enrollment policy</Label>
              <Select
                value={policy}
                onValueChange={(value) => setPolicy(value as 'open' | 'closed')}
              >
                <SelectTrigger id="settings-policy" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed — administrators assign membership</SelectItem>
                  <SelectItem value="open">Open — authenticated users may enroll</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              Authentication providers are configured globally in GoTrue.
            </p>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            {message && (
              <p role="alert" className="text-destructive">
                {message}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Delete project</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This deletes the project and all its memberships. Shared accounts remain.
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-3 border-t pt-6">
            <p className="text-sm text-muted-foreground">
              Deletes this project and its memberships. Shared GoTrue accounts and data in other
              applications remain. Type the project slug to confirm.
            </p>
            <Label htmlFor="delete-confirm">Project slug confirmation</Label>
            <Input
              id="delete-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <Button
              variant="destructive"
              disabled={busy || confirmation !== project.slug}
              onClick={remove}
            >
              Delete project
            </Button>
            {message && (
              <p role="alert" className="text-destructive">
                {message}
              </p>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  )
}
