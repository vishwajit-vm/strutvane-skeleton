// Builds the application (Laravel's bootstrap/app.php). `node strut dev`, `node strut start` and
// every `node strut` command load this file and take its default export.
//
// The health route /up is built in: it answers {"status":"ok"} to GET and HEAD, also during
// maintenance, so hosts, load balancers and a Dockerfile HEALTHCHECK can call it.
import { dirname } from 'node:path'
import { Application } from '@strutvane/framework'
import config from '../config/index.ts'
import api from '../routes/api.ts'
import web from '../routes/web.ts'
import providers from './providers.ts'

export default Application.configure({ basePath: dirname(import.meta.dirname) })
  .withConfig(config)
  .withProviders(providers)
  // The API lives under /api/v1 (the URL contract: @strutvane/auth answers at /api/v1/auth and the
  // UI's VITE_API_URL is /api/v1). Change it here, and in VITE_API_URL, together.
  .withRouting({ web, api, apiPrefix: '/api/v1', health: '/up' })
  .withMiddleware((_middleware) => {
    // App-wide middleware settings, for example:
    // _middleware.validateCsrfTokens({ except: ['webhooks/*'] })
  })
  .withExceptions((_exceptions) => {
    // How errors are reported and rendered, for example:
    // _exceptions.dontReport([PaymentDeclined])
  })
  .create()
