// GET /api/health: a small invokable controller that says the API is up. (GET /up, the built-in
// health route, is what hosts and load balancers call; it works during maintenance too.)
import type { HttpContext } from '@strutvane/framework'

export class HealthController {
  __invoke(ctx: HttpContext): Response {
    return ctx.json({ status: 'ok' })
  }
}
