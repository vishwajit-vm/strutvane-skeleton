// API routes, served under /api with the api middleware group (CSRF for cookie requests, the
// `api` rate limiter). Versioning such as /api/v1 is opt-in with Route.group({ prefix: 'v1' }).
//
// The CRUD routes for your models are added by `node strut migrate` (routes/resources.gen.ts).
import { defineRoutes, Route } from '@strutvane/framework'
import { HealthController } from '../app/http/controllers/health.controller.ts'

export default defineRoutes([Route.get('/health', HealthController).name('api.health')])
