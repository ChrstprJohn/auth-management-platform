import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { app } from '../dist/app.js'
import { prisma } from '../dist/db/prisma.js'

test('project routes enforce GoTrue identity and dashboard admin access', async (t) => {
  const userId = '11111111-1111-4111-8111-111111111111'
  const originalUrl = process.env.GOTRUE_URL
  process.env.GOTRUE_URL = 'http://auth.test'
  const realFetch = globalThis.fetch
  let upstreamStatus = 200
  let upstreamBody = { id: userId, user_metadata: { admin: true } }
  let unavailable = false
  let isAdmin = false
  let authCalls = 0
  let databaseCalls = 0
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'http://auth.test/user') {
      authCalls++
      assert.equal(options.headers.authorization, 'Bearer test-token')
      assert.equal(options.redirect, 'error')
      assert.ok(options.signal)
      if (unavailable) throw new TypeError('connection failed')
      return new Response(JSON.stringify(upstreamBody), { status: upstreamStatus })
    }
    return realFetch(url, options)
  })
  // Prisma delegates expose methods through a proxy rather than property descriptors.
  // Node's mock.method cannot resolve those methods, so replace and restore them explicitly.
  const originalFindUnique = prisma.dashboardAdmin.findUnique
  const originalFindMany = prisma.project.findMany
  t.after(() => {
    prisma.dashboardAdmin.findUnique = originalFindUnique
    prisma.project.findMany = originalFindMany
  })
  prisma.dashboardAdmin.findUnique = async ({ where }) => {
    databaseCalls++
    assert.equal(where.gotrueUserId, userId)
    return isAdmin ? { gotrueUserId: userId } : null
  }
  prisma.project.findMany = async () => []
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  const headers = { authorization: 'Bearer test-token' }
  try {
    for (const [path, method] of [['/api/projects', 'GET'], ['/api/projects', 'POST'], [`/api/projects/${userId}`, 'GET'], [`/api/projects/${userId}`, 'PATCH'], [`/api/projects/${userId}`, 'DELETE'], ['/api/operators', 'GET'], ['/api/audit', 'GET'], ['/api/me', 'GET']]) {
      assert.equal((await fetch(`${base}${path}`, { method })).status, 401)
    }
    assert.equal((await fetch(`${base}/api/projects`, { headers: { authorization: 'Bearer a b' } })).status, 401)
    assert.equal(authCalls, 0)
    upstreamStatus = 401
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 401)
    upstreamStatus = 403
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 401)
    assert.equal(databaseCalls, 0)
    upstreamStatus = 200
    for (const method of ['GET', 'POST']) {
      assert.equal((await fetch(`${base}/api/projects`, { method, headers })).status, 403)
    }
    isAdmin = true
    const accepted = await fetch(`${base}/api/projects`, { headers })
    assert.equal(accepted.status, 200)
    assert.deepEqual(await accepted.json(), { data: [], nextCursor: null })
    isAdmin = false
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 403)
    upstreamStatus = 500
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 503)
    upstreamStatus = 200
    upstreamBody = { id: 'invalid' }
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 503)
    unavailable = true
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 503)
    delete process.env.GOTRUE_URL
    assert.equal((await fetch(`${base}/api/projects`, { headers })).status, 503)
    assert.equal((await fetch(`${base}/health`)).status, 200)
  } finally {
    if (originalUrl === undefined) delete process.env.GOTRUE_URL
    else process.env.GOTRUE_URL = originalUrl
    server.closeAllConnections()
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await prisma.$disconnect()
  }
})
