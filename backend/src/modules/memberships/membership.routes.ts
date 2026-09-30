import { Router } from 'express'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'
import {
  ownMemberships,
  projectAccess,
  enroll,
  listMembers,
  assignMember,
  removeMember,
} from './membership.controller.js'

export const membershipRoutes = Router()
membershipRoutes.get('/me/memberships', requireAuth, ownMemberships)
membershipRoutes.get('/projects/:projectId/access', requireAuth, projectAccess)
membershipRoutes.post('/projects/:projectId/enroll', requireAuth, enroll)
membershipRoutes.get(
  '/projects/:projectId/members',
  requireAuth,
  requireDashboardAdmin,
  listMembers
)
membershipRoutes.put(
  '/projects/:projectId/members/:userId',
  requireAuth,
  requireDashboardAdmin,
  assignMember
)
membershipRoutes.delete(
  '/projects/:projectId/members/:userId',
  requireAuth,
  requireDashboardAdmin,
  removeMember
)
