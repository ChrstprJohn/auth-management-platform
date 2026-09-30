import { Alert, AlertDescription } from '@/components/ui/alert'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/projects', { replace: true })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck size={21} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Auth Management Platform</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage your authentication server
          </p>
        </div>

        {/* Card */}
        <Card>
          <CardContent className="p-6 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
              <div className="space-y-2">
                <Label htmlFor="login-email" className="block text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="block text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                id="login-submit"
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This login is for dashboard admins only.
        </p>
      </div>
    </div>
  )
}
