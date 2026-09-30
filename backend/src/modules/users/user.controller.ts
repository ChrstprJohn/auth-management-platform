import type { RequestHandler } from 'express'
import { userService } from './user.service.js'
export const listUsers: RequestHandler = async (request, response) => {
  response.json(await userService.list(request.query.page, request.query.limit))
}
export const getUser: RequestHandler = async (request, response) => {
  response.json({ data: await userService.get(request.params.id) })
}
export const createUser: RequestHandler = async (request, response) => {
  response
    .status(201)
    .json({ data: await userService.create(request.body, response.locals.gotrueUserId) })
}
export const updateUser: RequestHandler = async (request, response) => {
  response.json({
    data: await userService.update(request.params.id, request.body, response.locals.gotrueUserId),
  })
}
export const deleteUser: RequestHandler = async (request, response) => {
  await userService.delete(request.params.id, request.body, response.locals.gotrueUserId)
  response.status(204).end()
}
export const recoverUser: RequestHandler = async (request, response) => {
  response.json({
    data: await userService.recovery(request.params.id, response.locals.gotrueUserId),
  })
}
