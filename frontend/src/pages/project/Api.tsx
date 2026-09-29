import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const AUTH_URL = 'https://auth.chrbuilds.dev'

interface CodeBlockProps {
  code: string
  id: string
}

function CodeBlock({ code, id }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted/80">
      <pre className="text-xs font-mono p-4 overflow-x-auto text-foreground/90 leading-relaxed">
        {code}
      </pre>
      <Button
        id={`copy-${id}`}
        type="button"
        onClick={handleCopy}
        variant="outline" size="xs" className="absolute right-2 top-2 bg-background/90"
        aria-label="Copy code"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

interface EndpointSectionProps {
  title: string
  method: 'POST' | 'GET' | 'PUT' | 'DELETE'
  path: string
  description?: string
  code: string
  id: string
}

function EndpointSection({ title, method, path, description, code, id }: EndpointSectionProps) {
  const methodColors = {
    POST: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <Badge className={`font-mono font-bold ${methodColors[method]}`}>{method}</Badge>
          <code className="text-xs font-mono text-muted-foreground">{path}</code>
        </div>
      </div>
      <CodeBlock code={code} id={id} />
    </div>
  )
}

export function ApiPage() {
  const { projectId } = useParams<{ projectId: string }>()

  const endpoints: EndpointSectionProps[] = [
    {
      title: 'Sign Up',
      method: 'POST',
      path: '/signup',
      description: 'Register a new user. Include app_id in user_metadata to associate with this project.',
      id: 'signup',
      code: `curl -X POST \\
  ${AUTH_URL}/signup \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "password",
    "data": {
      "app_id": "${projectId}"
    }
  }'`,
    },
    {
      title: 'Sign In',
      method: 'POST',
      path: '/token?grant_type=password',
      description: 'Authenticate with email and password. Returns access + refresh tokens.',
      id: 'signin',
      code: `curl -X POST \\
  ${AUTH_URL}/token?grant_type=password \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'`,
    },
    {
      title: 'Get User',
      method: 'GET',
      path: '/user',
      description: 'Retrieve the currently authenticated user.',
      id: 'getuser',
      code: `curl -X GET \\
  ${AUTH_URL}/user \\
  -H "Authorization: Bearer <access_token>"`,
    },
    {
      title: 'Refresh Session',
      method: 'POST',
      path: '/token?grant_type=refresh_token',
      description: 'Exchange a refresh token for a new access token.',
      id: 'refresh',
      code: `curl -X POST \\
  ${AUTH_URL}/token?grant_type=refresh_token \\
  -H "Content-Type: application/json" \\
  -d '{
    "refresh_token": "<refresh_token>"
  }'`,
    },
    {
      title: 'Sign Out',
      method: 'POST',
      path: '/logout',
      description: 'Invalidate the current session.',
      id: 'signout',
      code: `curl -X POST \\
  ${AUTH_URL}/logout \\
  -H "Authorization: Bearer <access_token>"`,
    },
    {
      title: 'Reset Password',
      method: 'POST',
      path: '/recover',
      description: 'Send a password reset email.',
      id: 'recover',
      code: `curl -X POST \\
  ${AUTH_URL}/recover \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com"
  }'`,
    },
    {
      title: 'Update User',
      method: 'PUT',
      path: '/user',
      description: 'Update user email, password, or metadata.',
      id: 'updateuser',
      code: `curl -X PUT \\
  ${AUTH_URL}/user \\
  -H "Authorization: Bearer <access_token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "newemail@example.com"
  }'`,
    },
  ]

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-primary">Developer tools</p>
        <h2 className="text-2xl font-semibold tracking-tight">API Reference</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use these endpoints to integrate authentication into your application.
        </p>
      </div>

      {/* Endpoint URL */}
      <Card><CardContent className="space-y-2 p-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Authentication Endpoint</p>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono font-semibold">{AUTH_URL}</code>
          <Button
            id="copy-endpoint-url"
            type="button"
            onClick={() => navigator.clipboard.writeText(AUTH_URL)}
            variant="ghost" size="icon-xs"
            aria-label="Copy endpoint URL"
          >
            <Copy size={13} />
          </Button>
        </div>
      </CardContent></Card>

      {/* Endpoints */}
      <div className="space-y-6 divide-y divide-border">
        {endpoints.map((ep) => (
          <div key={ep.id} className="pt-6 first:pt-0">
            <EndpointSection {...ep} />
          </div>
        ))}
      </div>
    </div>
  )
}
