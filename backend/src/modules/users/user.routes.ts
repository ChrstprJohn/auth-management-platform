import { Router } from 'express'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'
import { listUsers, getUser, createUser, updateUser, deleteUser } from './user.controller.js'
export const userRoutes = Router()
userRoutes.use(requireAuth, requireDashboardAdmin)
userRoutes.get('/', listUsers)
userRoutes.post('/', createUser)
userRoutes.get('/:id', getUser)
userRoutes.patch('/:id', updateUser)
userRoutes.delete('/:id', deleteUser)
