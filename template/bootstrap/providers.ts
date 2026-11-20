// The service providers that run at boot, in order (Laravel's bootstrap/providers.php). There is
// no auto-discovery from node_modules: a package's installer (`node strut install:<name>`) adds
// its provider here, so you can always see what runs.
// @strut:if auth not none
// Sign-in, sessions and the auth endpoints under /api/v1/auth (node strut install:auth adds it).
import auth from '@strutvane/auth/provider'
// @strut:endif
import type { AnyProvider } from '@strutvane/framework'
import { AppServiceProvider } from '../app/providers/app.provider.ts'

const providers: readonly AnyProvider[] = [
  AppServiceProvider,
  // @strut:if auth not none
  auth,
  // @strut:endif
]

export default providers
