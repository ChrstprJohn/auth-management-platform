import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './db/prisma.js'

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
const server = app.listen(port, host, () => {
  console.log(`Auth Management Platform backend listening on ${host}:${port}`)
})

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  const timeout = setTimeout(() => server.closeAllConnections(), 10000)
  timeout.unref()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  clearTimeout(timeout)
  await prisma.$disconnect()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
