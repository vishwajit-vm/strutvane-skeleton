// API routes, served under /api/v1 (bootstrap/app.ts `apiPrefix`) with the api middleware group
// (CSRF for cookie requests, the `api` rate limiter). A later /api/v2 is a second prefix.
//
// The CRUD routes for your models are added by `node strut migrate` (routes/resources.gen.ts).
import { defineRoutes, Route } from '@strutvane/framework'
import { HealthController } from '../app/http/controllers/health.controller.ts'

export default defineRoutes([Route.get('/health', HealthController).name('api.health')])
