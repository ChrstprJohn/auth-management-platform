import { Router } from 'express'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'
import { ownMemberships, projectAccess, enroll, listMembers, assignMember, removeMember } from './membership.controller.js'

export const membershipRoutes = Router()
membershipRoutes.use(requireAuth)
membershipRoutes.get('/me/memberships', ownMemberships)
membershipRoutes.get('/projects/:projectId/access', projectAccess)
membershipRoutes.post('/projects/:projectId/enroll', enroll)
membershipRoutes.get('/projects/:projectId/members', requireDashboardAdmin, listMembers)
membershipRoutes.put('/projects/:projectId/members/:userId', requireDashboardAdmin, assignMember)
membershipRoutes.delete('/projects/:projectId/members/:userId', requireDashboardAdmin, removeMember)
