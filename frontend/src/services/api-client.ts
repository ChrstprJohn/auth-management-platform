import { accessToken, clearSession } from './auth-api'
export const apiUrl = import.meta.env.VITE_API_URL ?? '/api'
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const token = await accessToken()
  const response = await fetch(apiUrl + path, {
    method,
    signal: signal ?? AbortSignal.timeout(15000),
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    if (response.status === 401 || (response.status === 403 && result?.error?.code === 'forbidden'))
      clearSession()
    throw new Error(
      result?.error?.message ?? 'Request failed (' + response.status + '). Try again.'
    )
  }
  return response.status === 204 ? (undefined as T) : response.json()
}
