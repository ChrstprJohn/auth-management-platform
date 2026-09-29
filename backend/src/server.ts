import 'dotenv/config'
import express from 'express'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const app = express()
const port = Number(process.env.PORT ?? 3000)

app.disable('x-powered-by')
app.use(express.json())

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'auth-dashboard-backend' })
})

app.get('/health/ready', async (_request, response) => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    response.status(503).json({ status: 'unavailable' })
    return
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ status: 'ok' })
  } catch {
    response.status(503).json({ status: 'unavailable' })
  } finally {
    await prisma.$disconnect()
  }
})

export const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Auth dashboard backend listening on port ${port}`)
})
