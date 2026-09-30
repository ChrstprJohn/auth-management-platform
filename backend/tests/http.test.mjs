import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { once } from 'node:events'
import { browserAccess } from '../dist/middleware/browser-access.js'
import { requestLimit } from '../dist/middleware/request-limit.js'
import { errorHandler } from '../dist/middleware/error-handler.js'

test('HTTP boundary handles CORS, bounded bodies and request limiting', async () => {
  const original = process.env.ALLOWED_ORIGINS
  process.env.ALLOWED_ORIGINS = 'https://dashboard.example.test'
  const app = express()
  app.use(browserAccess, requestLimit(3), express.json({ limit: '32kb' }))
  app.post('/', (_request, response) => response.json({ ok: true }))
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const options = await fetch(base, {
      method: 'OPTIONS',
      headers: { origin: 'https://dashboard.example.test' },
    })
    assert.equal(options.status, 204)
    assert.equal(
      options.headers.get('access-control-allow-origin'),
      'https://dashboard.example.test'
    )
    assert.equal(
      (await fetch(base, { method: 'OPTIONS', headers: { origin: 'https://wrong.example.test' } }))
        .status,
      403
    )
    assert.equal(
      (
        await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{broken',
        })
      ).status,
      400
    )
    assert.equal(
      (
        await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ long: 'a'.repeat(33000) }),
        })
      ).status,
      413
    )
    assert.equal(
      (
        await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
      ).status,
      200
    )
    const limited = await fetch(base, { method: 'POST' })
    assert.equal(limited.status, 429)
    assert.ok(Number(limited.headers.get('retry-after')) > 0)
  } finally {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS
    else process.env.ALLOWED_ORIGINS = original
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
