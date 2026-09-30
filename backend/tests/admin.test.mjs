import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app } from '../dist/app.js'
import { prisma } from '../dist/db/prisma.js'
import { operatorRepository } from '../dist/modules/operators/operator.repository.js'

test('admin user API protects credentials, privileges and global deletion', async t => {
  const actor = '11111111-1111-4111-8111-111111111111'
  const target = '22222222-2222-4222-8222-222222222222'
  const oldUrl = process.env.GOTRUE_URL, oldToken = process.env.GOTRUE_ADMIN_TOKEN
  process.env.GOTRUE_URL = 'http://auth.test'
  process.env.GOTRUE_ADMIN_TOKEN = 'private-operator'
  const realFetch = globalThis.fetch
  let allowed = true, calls = 0, deleted = false
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'http://auth.test/user') return new Response(JSON.stringify({ id: actor }))
    if (url === 'http://auth.test/recover') {
      assert.deepEqual(JSON.parse(options.body), { email: 'fixture@example.test' })
      return new Response('{}')
    }
    if (url.startsWith('http://auth.test/admin')) {
      calls++
      assert.equal(options.headers.authorization, 'Bearer private-operator')
      if (options.method === 'DELETE') { deleted = true; return new Response('{}') }
      const user = { id: target, email: 'fixture@example.test', encrypted_password: 'hidden', app_metadata: { role: 'service_role' } }
      return new Response(JSON.stringify(url.includes('?') ? { users: [user], total: 1 } : user))
    }
    return realFetch(url, options)
  })
  const originals = [prisma.dashboardAdmin.findUnique, prisma.projectMembership.findMany, prisma.projectMembership.deleteMany, prisma.auditEvent.create]
  prisma.dashboardAdmin.findUnique = async ({ where }) => where.gotrueUserId === actor && allowed ? { gotrueUserId: actor } : null
  prisma.projectMembership.findMany = async () => []
  prisma.projectMembership.deleteMany = async () => ({ count: 0 })
  prisma.auditEvent.create = async ({ data }) => data
  t.after(() => {
    [prisma.dashboardAdmin.findUnique, prisma.projectMembership.findMany, prisma.projectMembership.deleteMany, prisma.auditEvent.create] = originals
    if (oldUrl === undefined) delete process.env.GOTRUE_URL; else process.env.GOTRUE_URL = oldUrl
    if (oldToken === undefined) delete process.env.GOTRUE_ADMIN_TOKEN; else process.env.GOTRUE_ADMIN_TOKEN = oldToken
  })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api/users`
  const call = (path = '', method = 'GET', body) => fetch(base + path, { method,
    headers: { authorization: 'Bearer regular-session', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  try {
    assert.equal((await fetch(base)).status, 401)
    allowed = false
    assert.equal((await call()).status, 403)
    assert.equal(calls, 0)
    allowed = true
    const list = await call()
    assert.equal(list.status, 200)
    const payload = await list.json()
    assert.equal(payload.data[0].email, 'fixture@example.test')
    assert.ok(!JSON.stringify(payload).includes('hidden'))
    assert.ok(!JSON.stringify(payload).includes('service_role'))
    assert.equal((await call(`/${target}`, 'PATCH', { role: 'service_role' })).status, 400)
    assert.equal((await call('', 'POST', { email: 'valid@example.test', password: 'short' })).status, 400)
    assert.equal((await call('', 'POST', { email: 'valid@example.test', password: 'long-fixture-password' })).status, 201)
    assert.equal((await call(`/${target}`, 'PATCH', { email_confirm: true })).status, 200)
    assert.equal((await call(`/${target}`, 'PATCH', { disabled: true })).status, 200)
    assert.equal((await call(`/${actor}`, 'PATCH', { disabled: true })).status, 409)
    assert.equal((await call(`/${target}/recovery`, 'POST')).status, 200)
    assert.equal((await call(`/${target}`, 'DELETE', {})).status, 400)
    assert.equal(deleted, false)
    assert.equal((await call(`/${target}`, 'DELETE', { confirmUserId: target })).status, 204)
    assert.equal(deleted, true)
    delete process.env.GOTRUE_ADMIN_TOKEN
    assert.equal((await call()).status, 503)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await prisma.$disconnect()
  }
})

test('operator revocation locks before checking and protects the last admin', async t => {
  const userId = '11111111-1111-4111-8111-111111111111'
  let count = 1, removed = false, locked = false
  const originalTransaction = prisma.$transaction
  t.after(() => { prisma.$transaction = originalTransaction })
  prisma.$transaction = async callback => callback({
    $executeRaw: async () => { locked = true },
    dashboardAdmin: {
      findUnique: async () => { assert.ok(locked); return { gotrueUserId: userId } },
      count: async () => count,
      delete: async () => { removed = true },
    },
    auditEvent: { create: async () => ({}) },
  })
  await assert.rejects(operatorRepository.revoke(userId, userId), error => error.code === 'last_admin')
  assert.equal(removed, false)
  count = 2
  await operatorRepository.revoke(userId, userId)
  assert.equal(removed, true)
})
