import type { RequestHandler } from 'express'
import { membershipService } from './membership.service.js'

export const ownMemberships: RequestHandler = async (_request, response) => {
  response.json({ data: await membershipService.mine(response.locals.gotrueUserId) })
}
export const projectAccess: RequestHandler = async (request, response) => {
  response.json({ data: await membershipService.access(request.params.projectId, response.locals.gotrueUserId) })
}
export const enroll: RequestHandler = async (request, response) => {
  response.json({ data: await membershipService.enroll(request.params.projectId, response.locals.gotrueUserId, request.body) })
}
export const listMembers: RequestHandler = async (request, response) => {
  response.json(await membershipService.list(request.params.projectId, request.query.page, request.query.limit))
}
export const assignMember: RequestHandler = async (request, response) => {
  response.json({ data: await membershipService.assign(request.params.projectId, request.params.userId, request.body, response.locals.gotrueUserId) })
}
export const removeMember: RequestHandler = async (request, response) => {
  await membershipService.remove(request.params.projectId, request.params.userId, response.locals.gotrueUserId)
  response.status(204).end()
}
