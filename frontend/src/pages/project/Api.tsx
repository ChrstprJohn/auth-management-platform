import { useProject } from '@/hooks/use-project'
import { authUrl } from '@/services/auth-api'
import { apiUrl } from '@/services/api-client'
export function ApiPage() {
  const { project } = useProject()
  const examples = [
    [
      'Create account',
      'POST ' + authUrl + '/signup',
      '{ "email": "<email>", "password": "<password>" }',
    ],
    [
      'Sign in',
      'POST ' + authUrl + '/token?grant_type=password',
      '{ "email": "<email>", "password": "<password>" }',
    ],
    [
      'Enroll in this project',
      'POST ' + apiUrl + '/projects/' + project.id + '/enroll',
      'Authorization: Bearer <user_access_token>\nBody: {}\nRequires open enrollment; assigns member role.',
    ],
    [
      'Check project access',
      'GET ' + apiUrl + '/projects/' + project.id + '/access',
      'Authorization: Bearer <user_access_token>\nResponse: { "data": { "projectId": "...", "allowed": true, "role": "member" } }',
    ],
    [
      'My memberships',
      'GET ' + apiUrl + '/me/memberships',
      'Authorization: Bearer <user_access_token>',
    ],
    [
      'Refresh session',
      'POST ' + authUrl + '/token?grant_type=refresh_token',
      '{ "refresh_token": "<refresh_token>" }',
    ],
  ]
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Application integration</h1>
      <p className="text-muted-foreground">
        Shared accounts authenticate through GoTrue. Project access is controlled by membership, not
        user metadata. Verify membership on protected requests in your application backend.
      </p>
      <dl className="space-y-2">
        <div>
          <dt className="font-medium">Project UUID</dt>
          <dd className="break-all font-mono text-sm">{project.id}</dd>
        </div>
        <div>
          <dt className="font-medium">Slug</dt>
          <dd>{project.slug}</dd>
        </div>
      </dl>
      {examples.map(([title, endpoint, body]) => (
        <section key={title} className="space-y-3 border-t pt-5">
          <h2 className="font-semibold">{title}</h2>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs">
            {endpoint + '\n\n' + body}
          </pre>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        Email confirmation may be required before enrollment. Confirmation and recovery email
        delivery require GoTrue mail configuration. Relative API URLs refer to this platform; use
        its deployed HTTPS URL from other apps. Never send operator credentials from an application.
      </p>
    </div>
  )
}
