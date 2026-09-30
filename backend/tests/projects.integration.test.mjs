import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app } from '../dist/app.js'
import { prisma } from '../dist/db/prisma.js'
import { randomUUID } from 'node:crypto'

test('project API creates, lists, reads, and rejects invalid or duplicate projects', async (t) => {
  const userId = randomUUID()
  const originalUrl = process.env.GOTRUE_URL
  process.env.GOTRUE_URL = 'http://auth.test'
  const realFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (url === 'http://auth.test/user') {
      assert.equal(options.headers.authorization, 'Bearer integration-token')
      return new Response(JSON.stringify({ id: userId }))
    }
    return realFetch(url, { ...options, headers: { ...options.headers, authorization: 'Bearer integration-token' } })
  })
  await prisma.dashboardAdmin.create({ data: { gotrueUserId: userId } })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const slug = `integration-${Date.now()}`
  let createdProjectId = null

  try {
    const invalid = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'Bad Slug', name: 'Bad' }),
    })
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).error.code, 'invalid_slug')

    const created = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, name: '  Integration project  ', description: 'Test' }),
    })
    assert.equal(created.status, 201)
    const { data: project } = await created.json()
    createdProjectId = project.id
    assert.equal(project.slug, slug)
    assert.equal(project.name, 'Integration project')
    assert.match(created.headers.get('location'), /^\/api\/projects\//)

    const duplicate = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, name: 'Duplicate' }),
    })
    assert.equal(duplicate.status, 409)

    const listed = await fetch(`${baseUrl}/api/projects?limit=100`)
    assert.equal(listed.status, 200)
    assert.ok((await listed.json()).data.some((row) => row.id === project.id))

    const fetched = await fetch(`${baseUrl}/api/projects/${project.id}`)
    assert.equal(fetched.status, 200)
    assert.equal((await fetched.json()).data.id, project.id)
  } finally {
    if (createdProjectId) await prisma.project.deleteMany({ where: { id: createdProjectId } })
    await prisma.dashboardAdmin.deleteMany({ where: { gotrueUserId: userId } })
    if (originalUrl === undefined) delete process.env.GOTRUE_URL
    else process.env.GOTRUE_URL = originalUrl
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await prisma.$disconnect()
  }
})
