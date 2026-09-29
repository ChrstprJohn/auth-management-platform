import 'dotenv/config'
import { app } from './app.js'
import { prisma } from './db/prisma.js'

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
const server = app.listen(port, host, () => {
  console.log(`Auth dashboard backend listening on ${host}:${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
