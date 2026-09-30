export const authUrl = import.meta.env.VITE_GOTRUE_URL ?? 'https://auth.chrbuilds.dev'
interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
}
let session: Session | null = null
let refreshing: Promise<string> | null = null
let sessionVersion = 0

export async function authRequest(path: string, body: unknown) {
  const version = sessionVersion
  const response = await fetch(authUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(
      response.status === 400 || response.status === 401
        ? 'Sign-in failed. Check your credentials and account confirmation.'
        : 'Authentication is unavailable. Try again.'
    )
  const result = await response.json()
  if (version !== sessionVersion) throw new Error('Session ended. Sign in again.')
  session = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Date.now() + result.expires_in * 1000,
  }
  return session.access_token
}
export async function accessToken(): Promise<string> {
  if (!session) throw new Error('Sign in to continue.')
  if (session.expires_at > Date.now() + 30000) return session.access_token
  refreshing ??= authRequest('/token?grant_type=refresh_token', {
    refresh_token: session.refresh_token,
  })
    .catch((error) => {
      clearSession()
      throw error
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}
export function clearSession() {
  session = null
  sessionVersion++
  window.dispatchEvent(new Event('auth-session-ended'))
}
export async function signOut() {
  const token = session?.access_token
  clearSession()
  if (token)
    await fetch(authUrl + '/logout', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined)
}
