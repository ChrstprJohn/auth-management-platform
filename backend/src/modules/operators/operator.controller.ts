import type { RequestHandler } from 'express'
import { operatorService } from './operator.service.js'
export const listOperators: RequestHandler = async (request, response) => {
  response.json(await operatorService.list(request.query.page, request.query.limit))
}
export const grantOperator: RequestHandler = async (request, response) => {
  response.json({ data: await operatorService.grant(request.params.id, response.locals.gotrueUserId) })
}
export const revokeOperator: RequestHandler = async (request, response) => {
  await operatorService.revoke(request.params.id, response.locals.gotrueUserId)
  response.status(204).end()
}
