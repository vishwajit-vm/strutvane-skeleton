// The service providers that run at boot, in order (Laravel's bootstrap/providers.php). There is
// no auto-discovery from node_modules: a package's installer (`node strut install:<name>`) adds
// its provider here, so you can always see what runs.
import type { AnyProvider } from '@strutvane/framework'
import { AppServiceProvider } from '../app/providers/app.provider.ts'

const providers: readonly AnyProvider[] = [AppServiceProvider]

export default providers
