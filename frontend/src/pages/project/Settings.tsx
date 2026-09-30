import { useAction } from '@/hooks/use-action'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProject } from '@/hooks/use-project'
import { adminApi } from '@/services/admin-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
export function SettingsPage() {
  const { project, reload } = useProject()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name),
    [slug, setSlug] = useState(project.slug)
  const [description, setDescription] = useState(project.description ?? '')
  const [policy, setPolicy] = useState(project.enrollmentPolicy)
  const [confirmation, setConfirmation] = useState('')
  const { busy, error: message, perform } = useAction()
  async function save(event: FormEvent) {
    event.preventDefault()
    await perform(
      () =>
        adminApi.updateProject(project.id, { name, slug, description, enrollmentPolicy: policy }),
      reload
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
          <Input
            id="settings-description"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-policy">Enrollment policy</Label>
          <select
            id="settings-policy"
            className="block w-full rounded-md border bg-background p-2"
            value={policy}
            onChange={(e) => setPolicy(e.target.value as 'open' | 'closed')}
          >
            <option value="closed">Closed — administrators assign membership</option>
            <option value="open">Open — authenticated users may enroll</option>
          </select>
        </div>
        <p className="text-sm text-muted-foreground">
          Authentication providers are configured globally in GoTrue.
        </p>
        <Button disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
      </form>
      {message && (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      )}
      <section className="space-y-3 border-t pt-6">
        <h2 className="font-semibold">Delete project</h2>
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
      </section>
    </div>
  )
}
