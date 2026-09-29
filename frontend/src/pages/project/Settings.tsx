import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MOCK_PROJECTS } from '@/types/project'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface ToggleProps {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}

function Toggle({ id, label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 cursor-pointer"
    >
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        checked={checked}
      />
    </label>
  )
}

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = MOCK_PROJECTS.find((p) => p.appId === projectId)

  const [name, setName] = useState(project?.name ?? '')
  const [appId, setAppId] = useState(projectId ?? '')
  const [emailAuth, setEmailAuth] = useState(true)
  const [googleAuth, setGoogleAuth] = useState(false)
  const [githubAuth, setGithubAuth] = useState(false)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Project configuration</p>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure project name and authentication options.
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader><CardTitle>General</CardTitle><CardDescription>Update how this project is identified in the dashboard.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="settings-project-name">
            Project Name
          </Label>
          <Input
            id="settings-project-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-app-id">
            App ID
          </Label>
          <Input
            id="settings-app-id"
            type="text"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            This is the <code className="font-mono">app_id</code> value in user metadata.
          </p>
        </div>
        <Button
          id="settings-save-btn"
          type="button"
          size="sm"
        >
          <Save size={12} />
          Save Changes
        </Button>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card>
        <CardHeader><CardTitle>Authentication</CardTitle><CardDescription>Choose which sign-in methods are available for this project.</CardDescription></CardHeader>
        <CardContent><div className="space-y-4 divide-y divide-border">
          <Toggle
            id="toggle-email-auth"
            label="Email authentication"
            description="Allow users to sign up and sign in with email and password."
            checked={emailAuth}
            onChange={setEmailAuth}
          />
          <div className="pt-4">
            <Toggle
              id="toggle-google-auth"
              label="Google"
              description="OAuth with Google — requires configuration in GoTrue."
              checked={googleAuth}
              onChange={setGoogleAuth}
              disabled
            />
          </div>
          <div className="pt-4">
            <Toggle
              id="toggle-github-auth"
              label="GitHub"
              description="OAuth with GitHub — requires configuration in GoTrue."
              checked={githubAuth}
              onChange={setGithubAuth}
              disabled
            />
          </div>
        </div></CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/25">
        <CardHeader><CardTitle className="text-destructive">Danger Zone</CardTitle><CardDescription>
          Irreversible and destructive actions. These will be enabled when the admin API is connected.
        </CardDescription></CardHeader>
        <CardContent>
        <Button
          id="delete-project-btn"
          type="button"
          disabled
          variant="destructive" size="sm"
        >
          Delete Project
        </Button>
        </CardContent>
      </Card>
    </div>
  )
}
