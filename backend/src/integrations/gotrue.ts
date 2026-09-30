import { HttpError } from '../middleware/error-handler.js'

import type { AuthUser } from '../models/auth-user.js'
export type { AuthUser } from '../models/auth-user.js'

export function publicUser(user: AuthUser): AuthUser {
  return { id: user.id, email: user.email, created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at, last_sign_in_at: user.last_sign_in_at }
}

export async function gotrueAdmin<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const url = process.env.GOTRUE_URL
  const token = process.env.GOTRUE_ADMIN_TOKEN
  if (!url || !token) throw new HttpError(503, 'admin_unavailable', 'Authentication administration is not configured')
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}/admin${path}`, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(10000), redirect: 'error',
    })
    if (response.status === 404) throw new HttpError(404, 'user_not_found', 'Authentication user not found')
    if (response.status === 422 || response.status === 400 || response.status === 409) {
      throw new HttpError(response.status, 'auth_request_rejected', 'Authentication server rejected this request')
    }
    if (!response.ok) throw new Error('Upstream request failed')
    if (response.status === 204) return undefined as T
    return await response.json() as T
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'admin_unavailable', 'Authentication administration is unavailable')
  }
}
