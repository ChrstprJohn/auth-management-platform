import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useProject } from '@/hooks/use-project'
import { authUrl } from '@/services/auth-api'
import { apiUrl } from '@/services/api-client'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from '@/components/ui/card'

function CodeExample({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle role="heading" aria-level={3}>{title}</CardTitle>
        <CardAction>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard
              .writeText(code)
              .then(() => {
                setCopied(true)
                setError('')
                setTimeout(() => setCopied(false), 2000)
              })
              .catch(() => setError('Select and copy the code manually.'))
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3">
      <pre className="max-w-full overflow-x-auto rounded-lg bg-muted/40 p-4 text-xs leading-6">
        <code>{code}</code>
      </pre>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      </CardContent>
    </Card>
  )
}
export function ApiPage() {
  const { project } = useProject()
  const setup = `const AUTH_URL = ${JSON.stringify(authUrl)};
const PLATFORM_URL = ${JSON.stringify(apiUrl)}; // Use a full HTTPS URL in another app.
const PROJECT_ID = ${JSON.stringify(project.id)};

async function request(url, method = 'GET', body, token) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(
    result.error?.message || result.msg || result.error_description ||
    'Request failed: ' + response.status
  );
  return result;
}`
  const signup = `const session = await request(AUTH_URL + '/signup', 'POST', { email, password });
// No access_token? Confirm the email, then sign in. Do not enroll yet.`
  const login = `const session = await request(AUTH_URL + '/token?grant_type=password', 'POST', {
  email, password
});`
  const enroll = `await request(PLATFORM_URL + '/projects/' + PROJECT_ID + '/enroll',
  'POST', {}, session.access_token);
// Self-enrollment requires an OPEN project. It always assigns member role.`
  const access = `const { data: access } = await request(
  PLATFORM_URL + '/projects/' + PROJECT_ID + '/access',
  'GET', undefined, session.access_token
);
if (!access.allowed) throw new Error('This account has no project access.');`
  const combined = `async function signupAndEnroll(email, password) {
  ${signup.replaceAll('\n', '\n  ')}
  if (!session.access_token) return { status: 'confirmation_required' };
  // If this fails, the account already exists. Sign in and retry enrollment.
  ${enroll.replaceAll('\n', '\n  ')}
  ${access.replaceAll('\n', '\n  ')}
  return { status: 'ready', session, access };
}

async function loginAndCheckAccess(email, password) {
  ${login.replaceAll('\n', '\n  ')}
  ${access.replaceAll('\n', '\n  ')}
  return { session, access };
}`
  const admin = `// Dashboard operator's normal access token, NOT a GoTrue admin JWT.
const { data: user } = await request(PLATFORM_URL + '/users', 'POST', {
  email, password, email_confirm: false
}, dashboardAccessToken);

// Keep user.id if assignment fails; retry only this PUT.
await request(PLATFORM_URL + '/projects/' + PROJECT_ID + '/members/' + user.id,
  'PUT', { role: 'member' }, dashboardAccessToken);
// Administrative assignment works for open and closed projects.`
  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Application integration</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          GoTrue creates identities and verifies credentials. This platform controls which projects
          those identities can access.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Project integration</CardTitle>
          <CardDescription>Use this project ID in the examples below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{project.slug}</Badge>
          <Badge variant="outline" className="capitalize">{project.enrollmentPolicy} enrollment</Badge>
        </div>
        <p className="break-all font-mono text-sm">{project.id}</p>
        </CardContent>
      </Card>
      <Alert>
        <AlertTitle>Enforce access in your application backend</AlertTitle>
        <AlertDescription>
          A browser membership check supports the interface. Your backend must verify the user's
          token and project membership on protected requests. Metadata and a successful login alone
          do not grant project access.
        </AlertDescription>
      </Alert>
      <Tabs defaultValue="combined" className="space-y-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="combined">Combined flows</TabsTrigger>
          <TabsTrigger value="individual">Individual calls</TabsTrigger>
          <TabsTrigger value="admin">Admin creation</TabsTrigger>
        </TabsList>
        <TabsContent value="combined" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Use these functions in your app's signup and login handlers. Calls run in sequence
            because enrollment and access checks require the GoTrue token.
          </p>
          <CodeExample title="Shared request helper" code={setup} />
          <CodeExample title="Signup + enroll, and login + check access" code={combined} />
        </TabsContent>
        <TabsContent value="individual" className="space-y-6">
          <CodeExample title="Shared request helper" code={setup} />
          <CodeExample title="Create an identity" code={signup} />
          <CodeExample title="Sign in" code={login} />
          <CodeExample title="Enroll the signed-in user" code={enroll} />
          <CodeExample title="Check membership" code={access} />
          <CodeExample
            title="List own memberships"
            code={`const memberships = await request(PLATFORM_URL + '/me/memberships', 'GET', undefined, session.access_token);`}
          />
          <CodeExample
            title="Refresh a session"
            code={`const refreshed = await request(AUTH_URL + '/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token });`}
          />
        </TabsContent>
        <TabsContent value="admin" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            The project's Create account dialog performs these two protected calls. Only dashboard
            administrators can use them. A global account is created first, then assigned to this
            project.
          </p>
          <CodeExample title="Shared request helper" code={setup} />
          <CodeExample title="Create and assign as an administrator" code={admin} />
        </TabsContent>
      </Tabs>
      <Alert>
        <AlertTitle>Confirmation and retries</AlertTitle>
        <AlertDescription>
          When GoTrue requires confirmation, finish confirmation and sign in before enrollment. If
          account creation succeeds but enrollment fails, keep the account and retry enrollment
          after login. Never automatically repeat signup after a network timeout. Closed projects
          require an administrator's assignment.
        </AlertDescription>
      </Alert>
      <p className="text-sm text-muted-foreground">
        Use the platform's deployed HTTPS URL from another website and configure ALLOWED_ORIGINS on
        the backend for that website. Keep passwords and tokens out of logs. Never put
        GOTRUE_ADMIN_TOKEN in browser code.
      </p>
    </div>
  )
}
