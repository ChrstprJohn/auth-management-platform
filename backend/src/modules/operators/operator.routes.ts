import { Router } from 'express'
import { requireAuth, requireDashboardAdmin } from '../../middleware/dashboard-auth.js'
import { listOperators, grantOperator, revokeOperator } from './operator.controller.js'
export const operatorRoutes = Router()
operatorRoutes.use(requireAuth, requireDashboardAdmin)
operatorRoutes.get('/', listOperators)
operatorRoutes.put('/:id', grantOperator)
operatorRoutes.delete('/:id', revokeOperator)
