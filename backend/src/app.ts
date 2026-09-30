import express from 'express'
import { prisma } from './db/prisma.js'
import { projectRoutes } from './modules/projects/project.routes.js'
import { membershipRoutes } from './modules/memberships/membership.routes.js'
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
app.use('/api', () => { throw new HttpError(404, 'not_found', 'Route not found') })
app.use(errorHandler)
