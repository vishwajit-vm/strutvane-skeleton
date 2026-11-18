// The application cache (Laravel's config/cache.php): `Cache.remember(...)`, rate limiters and
// the framework's own caches use the default store.
//
// - `file`: storage/framework/cache; survives restarts; fine for one server.
// - `memory`: per process, gone on restart; for tests.
//
// Redis arrives with `@strutvane/redis` (`node strut install:redis`).
import { type CacheConfig, defineConfig } from '@strutvane/framework'

export default defineConfig(
  (env) =>
    ({
      /** The store `Cache` uses when none is named. */
      default: env.string('CACHE_STORE', 'file'),
      stores: {
        file: { driver: 'file', path: 'storage/framework/cache' },
        memory: { driver: 'memory' },
      },
    }) satisfies CacheConfig,
)
