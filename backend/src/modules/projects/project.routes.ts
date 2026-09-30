import { Router } from 'express'
import { createProject, getProject, listProjects } from './project.controller.js'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'

export const projectRoutes = Router()
projectRoutes.use(requireAuth, requireDashboardAdmin)

projectRoutes.get('/', listProjects)
projectRoutes.post('/', createProject)
projectRoutes.get('/:id', getProject)
