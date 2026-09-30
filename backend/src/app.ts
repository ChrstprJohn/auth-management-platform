import express from 'express'
import { prisma } from './db/prisma.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import { membershipRoutes } from './modules/memberships/membership.routes.js'
import { userRoutes } from './modules/users/user.routes.js'
import { operatorRoutes } from './modules/operators/operator.routes.js'
import { auditRoutes } from './modules/audit/audit.routes.js'
import { errorHandler, HttpError } from './middleware/error-handler.js'

export const app = express()

app.disable('x-powered-by')
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
app.get('/api/me', async (_request, response) => {
  const id = response.locals.gotrueUserId as string
  response.json({ data: { id, isAdmin: Boolean(await prisma.dashboardAdmin.findUnique({ where: { gotrueUserId: id } })) } })
})
app.use('/api', () => { throw new HttpError(404, 'not_found', 'Route not found') })
app.use(errorHandler)
