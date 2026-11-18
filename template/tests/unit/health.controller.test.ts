// A first unit test: plain functions and classes need no booted app.
import { describe, expect, it } from 'vitest'
import { HealthController } from '../../app/http/controllers/health.controller.ts'

describe('HealthController', () => {
  it('is an invokable controller', () => {
    expect(typeof new HealthController().__invoke).toBe('function')
  })
})
