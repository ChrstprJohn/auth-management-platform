import type { RequestHandler } from 'express'
import { identityService } from './identity.service.js'
export const ownIdentity: RequestHandler = async (_request, response) => {
  response.json({ data: await identityService.get(response.locals.gotrueUserId) })
}
