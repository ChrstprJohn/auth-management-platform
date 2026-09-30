import type { RequestHandler } from 'express'
import { HttpError } from './error-handler.js'

export const browserAccess: RequestHandler = (request, response, next) => {
  response.set('Cache-Control', 'no-store')
  response.set('X-Content-Type-Options', 'nosniff')
  const origin = request.get('origin')
  const allowed = (process.env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
  if (origin && allowed.includes(origin)) {
    response.vary('Origin')
    response.set('Access-Control-Allow-Origin', origin)
    response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  }
  if (request.method === 'OPTIONS') {
    if (!origin || !allowed.includes(origin)) throw new HttpError(403, 'origin_not_allowed', 'Browser origin is not allowed')
    response.status(204).end()
    return
  }
  next()
}
