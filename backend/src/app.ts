import express from 'express'
import { prisma } from './db/prisma.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import { membershipRoutes } from './modules/memberships/membership.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { operatorRoutes } from './modules/operators/operator.routes.js'
import { auditRoutes } from './modules/audit/audit.routes.js'
import { identityRoutes } from './modules/identity/identity.routes.js'
import { browserAccess } from './middleware/browser-access.js'
import { requestLimit } from './middleware/request-limit.js'
import { errorHandler, HttpError } from './middleware/error-handler.js'

export const app = express()

app.disable('x-powered-by')
// Set only when the API is private behind exactly one trusted reverse proxy.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)
app.use('/api', browserAccess)
app.use('/api', requestLimit())
app.use(express.json({ limit: '32kb' }))

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'auth-dashboard-backend' })
})

app.get('/health/ready', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ok' })
  } catch {
    response.status(503).json({ status: 'unavailable' })
  }
})

app.use('/api', membershipRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/users', userRoutes)
app.use('/api/operators', operatorRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/me', identityRoutes)
app.use('/api', () => {
  throw new HttpError(404, 'not_found', 'Route not found')
})
app.use(errorHandler)
