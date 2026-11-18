// A first feature test: the app boots and answers its health routes. Run: npm test
//
// The app is booted in-process and requests go straight to `app.handle()`, so no port is opened.
// Tests get their own random APP_KEY: they never need (or see) the key in your .env.
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import app from '../../bootstrap/app.ts'

beforeAll(async () => {
  process.env['APP_ENV'] = 'testing'
  process.env['APP_KEY'] = `base64:${randomBytes(32).toString('base64')}`
  await app.boot()
})

afterAll(async () => {
  await app.shutdown()
})

describe('health', () => {
  it('GET /up answers ok (the route hosts and load balancers call)', async () => {
    const response = await app.handle(new Request('http://localhost/up'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('GET /api/health answers ok', async () => {
    const response = await app.handle(new Request('http://localhost/api/health'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('an unknown route is a 404 problem, not a crash', async () => {
    const response = await app.handle(new Request('http://localhost/api/does-not-exist'))
    expect(response.status).toBe(404)
  })
})
