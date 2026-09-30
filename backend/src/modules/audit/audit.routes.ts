import { Router } from 'express'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'
import { listAudit } from './audit.controller.js'
export const auditRoutes = Router()
auditRoutes.use(requireAuth, requireDashboardAdmin)
auditRoutes.get('/', listAudit)
