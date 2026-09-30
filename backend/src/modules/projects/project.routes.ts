import { Router } from 'express'
import { createProject, getProject, listProjects } from './project.controller.js'

export const projectRoutes = Router()

projectRoutes.get('/', listProjects)
projectRoutes.post('/', createProject)
projectRoutes.get('/:id', getProject)
