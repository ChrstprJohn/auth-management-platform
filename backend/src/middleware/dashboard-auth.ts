import type { RequestHandler } from 'express'
import { prisma } from '../db/prisma.js'
import { HttpError } from './error-handler.js'
import { isUuid } from '../lib/validation.js'

// The identity comes only from GoTrue, never from browser-supplied user metadata.
export const requireAuth: RequestHandler = async (request, response, next) => {
  const match = /^Bearer ([^\s]+)$/i.exec(request.get('authorization') ?? '')
  if (!match) throw new HttpError(401, 'unauthorized', 'A Bearer access token is required')

  const baseUrl = process.env.GOTRUE_URL
  if (!baseUrl)
    throw new HttpError(503, 'auth_unavailable', 'Authentication service is unavailable')

  let user: unknown
  try {
    const upstream = await fetch(`${baseUrl.replace(/\/+$/, '')}/user`, {
      headers: { authorization: `Bearer ${match[1]}` },
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    })
    if (upstream.status === 401 || upstream.status === 403) {
      throw new HttpError(401, 'unauthorized', 'Access token is invalid or expired')
    }
    if (!upstream.ok) throw new Error('GoTrue unavailable')
    user = await upstream.json()
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(503, 'auth_unavailable', 'Authentication service is unavailable')
  }

  if (!user || typeof user !== 'object' || !('id' in user) || !isUuid(user.id)) {
    throw new HttpError(503, 'auth_unavailable', 'Authentication service is unavailable')
  }

  response.locals.gotrueUserId = user.id
  next()
}

export const requireDashboardAdmin: RequestHandler = async (_request, response, next) => {
  const gotrueUserId: unknown = response.locals.gotrueUserId
  if (!isUuid(gotrueUserId)) {
    throw new HttpError(401, 'unauthorized', 'Authentication is required')
  }
  const admin = await prisma.dashboardAdmin.findUnique({ where: { gotrueUserId } })
  if (!admin) throw new HttpError(403, 'forbidden', 'Dashboard administrator access is required')
  next()
}
