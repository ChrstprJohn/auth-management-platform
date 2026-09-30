import { Router } from 'express'
import { requireAuth } from '../../middleware/dashboard-auth.js'
import { ownIdentity } from './identity.controller.js'
export const identityRoutes = Router()
identityRoutes.get('/', requireAuth, ownIdentity)
