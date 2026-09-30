// Foreground-only local UI verification. No calls to or changes on the VM.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'

process.env.GOTRUE_URL = 'http://127.0.0.1:3901'
process.env.GOTRUE_ADMIN_TOKEN = 'fixture-operator'
const { app } = await import('../../dist/app.js')
const { prisma } = await import('../../dist/db/prisma.js')
const actor = randomUUID(),
  member = randomUUID()
const user = {
  id: member,
  email: 'member@example.test',
  created_at: new Date().toISOString(),
  email_confirmed_at: new Date().toISOString(),
}
const auth = createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5174')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.setHeader('Content-Type', 'application/json')
  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }
  if (request.url.startsWith('/token')) {
    response.end(
      JSON.stringify({
        access_token: 'fixture-session',
        refresh_token: 'fixture-refresh',
        expires_in: 3600,
      })
    )
    return
  }
  if (request.url === '/user') {
    response.end(JSON.stringify({ id: actor }))
    return
  }
  if (request.url.startsWith('/admin/users?')) {
    response.end(JSON.stringify({ users: [user], total: 1 }))
    return
  }
  if (request.url === '/admin/users/' + member) {
    response.end(JSON.stringify(user))
    return
  }
  if (request.url === '/admin/users/' + actor) {
    response.end(JSON.stringify({ id: actor, email: 'operator@example.test' }))
    return
  }
  if (request.url === '/logout') {
    response.end('{}')
    return
  }
  response.writeHead(404)
  response.end('{}')
})
let project
let api
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  for (const server of [api, auth])
    if (server) {
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
  if (project) await prisma.project.deleteMany({ where: { id: project.id } })
  await prisma.dashboardAdmin.deleteMany({ where: { gotrueUserId: actor } })
  await prisma.auditEvent.deleteMany({ where: { actorId: actor } })
  await prisma.$disconnect()
}
try {
  await prisma.dashboardAdmin.create({ data: { gotrueUserId: actor } })
  project = await prisma.project.create({
    data: {
      slug: 'ui-fixture-' + randomUUID(),
      name: 'UI verification project',
      description: 'Temporary local verification fixture',
      enrollmentPolicy: 'open',
    },
  })
  await prisma.projectMembership.create({ data: { projectId: project.id, gotrueUserId: member } })
  auth.listen(3901, '127.0.0.1')
  await once(auth, 'listening')
  api = app.listen(3900, '127.0.0.1')
  await once(api, 'listening')
  console.log('Local UI fixture ready on 3900/3901. Project:', project.id)
  process.once('SIGINT', () => void stop())
  process.once('SIGTERM', () => void stop())
} catch (error) {
  await stop()
  throw error
}
