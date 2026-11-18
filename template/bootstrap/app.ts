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
  .withRouting({ web, api, health: '/up' })
  .withMiddleware((_middleware) => {
    // App-wide middleware settings, for example:
    // _middleware.validateCsrfTokens({ except: ['webhooks/*'] })
  })
  .withExceptions((_exceptions) => {
    // How errors are reported and rendered, for example:
    // _exceptions.dontReport([PaymentDeclined])
  })
  .create()
