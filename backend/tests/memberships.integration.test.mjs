import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { app } from '../dist/app.js'
import { prisma } from '../dist/db/prisma.js'

test('membership APIs enforce project isolation, policy, role authority and retry safety', async t => {
  const admin = randomUUID(), member = randomUUID()
  const originalUrl = process.env.GOTRUE_URL
  const originalToken = process.env.GOTRUE_ADMIN_TOKEN
  process.env.GOTRUE_URL = 'http://auth.test'
  process.env.GOTRUE_ADMIN_TOKEN = 'operator-token'
  const realFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'http://auth.test/user') {
      return new Response(JSON.stringify({ id: options.headers.authorization === 'Bearer admin' ? admin : member }))
    }
    if (url === `http://auth.test/admin/users/${member}`) {
      assert.equal(options.headers.authorization, 'Bearer operator-token')
      return new Response(JSON.stringify({ id: member, email: 'fixture@example.test' }))
    }
    return realFetch(url, options)
  })
  const projects = []
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/api`
  async function call(path, token = 'member', method = 'GET', body) {
    return fetch(base + path, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  }
  try {
    await prisma.dashboardAdmin.create({ data: { gotrueUserId: admin } })
    for (const policy of ['open', 'closed']) {
      projects.push(await prisma.project.create({ data: { slug: `test-${randomUUID()}`, name: 'Membership test', enrollmentPolicy: policy } }))
    }
    const [open, closed] = projects
    assert.equal((await call(`/projects/${open.id}/access`)).status, 200)
    assert.equal((await (await call(`/projects/${open.id}/access`)).json()).data.allowed, false)
    assert.equal((await call(`/projects/${closed.id}/enroll`, 'member', 'POST')).status, 403)
    assert.equal((await call(`/projects/${open.id}/enroll`, 'member', 'POST', { role: 'manager' })).status, 400)
    const enrolled = await call(`/projects/${open.id}/enroll`, 'member', 'POST')
    assert.equal(enrolled.status, 200)
    assert.equal((await enrolled.json()).data.role, 'member')
    assert.equal((await call(`/projects/${open.id}/enroll`, 'member', 'POST')).status, 200)
    assert.equal(await prisma.projectMembership.count({ where: { projectId: open.id, gotrueUserId: member } }), 1)
    assert.equal((await (await call(`/projects/${closed.id}/access`)).json()).data.allowed, false)
    assert.equal((await call(`/projects/${open.id}/members`)).status, 403)
    assert.equal((await call(`/projects/${closed.id}/members/${member}`, 'member', 'PUT', { role: 'manager' })).status, 403)
    assert.equal((await call(`/projects/${closed.id}/members/${member}`, 'admin', 'PUT', { role: 'manager' })).status, 200)
    assert.equal((await (await call(`/projects/${closed.id}/access`)).json()).data.role, 'manager')
    const mine = (await (await call('/me/memberships')).json()).data
    assert.equal(mine.length, 2)
    assert.ok(mine.every(row => row.gotrueUserId === member))
    assert.equal((await call(`/projects/${closed.id}/members/${member}`, 'admin', 'DELETE')).status, 204)
    assert.equal((await (await call(`/projects/${closed.id}/access`)).json()).data.allowed, false)
    const list = await call(`/projects/${open.id}/members`, 'admin')
    assert.equal(list.status, 200)
    assert.equal((await list.json()).data[0].user.email, 'fixture@example.test')
  } finally {
    await prisma.project.deleteMany({ where: { id: { in: projects.map(p => p.id) } } })
    await prisma.dashboardAdmin.deleteMany({ where: { gotrueUserId: admin } })
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: [admin, member] } } })
    if (originalUrl === undefined) delete process.env.GOTRUE_URL
    else process.env.GOTRUE_URL = originalUrl
    if (originalToken === undefined) delete process.env.GOTRUE_ADMIN_TOKEN
    else process.env.GOTRUE_ADMIN_TOKEN = originalToken
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    await prisma.$disconnect()
  }
})
