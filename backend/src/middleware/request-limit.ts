import type { RequestHandler } from 'express'
import { HttpError } from './error-handler.js'

// Per-process protection. A multi-instance deployment should use shared limits at its gateway.
export function requestLimit(max = 300, windowMs = 60000): RequestHandler {
  const windows = new Map<string, { count: number; resetAt: number }>()
  return (request, response, next) => {
    const now = Date.now()
    const key = request.ip ?? 'unknown'
    if (windows.size >= 10000) {
      for (const [id, entry] of windows) if (entry.resetAt <= now) windows.delete(id)
    }
    let entry = windows.get(key)
    if (!entry || entry.resetAt <= now) {
      if (!entry && windows.size >= 10000) throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.')
      entry = { count: 0, resetAt: now + windowMs }
      windows.set(key, entry)
    }
    entry.count++
    if (entry.count > max) {
      response.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      throw new HttpError(429, 'rate_limited', 'Too many requests. Try again later.')
    }
    next()
  }
}
