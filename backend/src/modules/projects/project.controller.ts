import type { RequestHandler } from 'express'
import { projectService } from './project.service.js'

export const createProject: RequestHandler = async (request, response) => {
  const project = await projectService.create(request.body, response.locals.gotrueUserId)
  response.status(201).location(`/api/projects/${project.id}`).json({ data: project })
}

export const getProject: RequestHandler = async (request, response) => {
  const project = await projectService.get(request.params.id)
  response.json({ data: project })
}

export const listProjects: RequestHandler = async (request, response) => {
  const result = await projectService.list(request.query.limit, request.query.cursor)
  response.json(result)
}

export const updateProject: RequestHandler = async (request, response) => {
  response.json({ data: await projectService.update(request.params.id, request.body, response.locals.gotrueUserId) })
}

export const deleteProject: RequestHandler = async (request, response) => {
  await projectService.delete(request.params.id, response.locals.gotrueUserId)
  response.status(204).end()
}
