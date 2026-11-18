// Every defineConfig file, keyed by file name: `config('app.name')` reads config/app.ts.
// bootstrap/app.ts hands this object to `.withConfig(...)`. A new config file needs one line here.
//
// Not listed on purpose: config/tenancy.ts, config/auth.ts and config/ui.ts are plain data that
// `node strut` and the auth and UI packages read directly.
import type { ConfigFiles } from '@strutvane/framework'
import app from './app.ts'
import cache from './cache.ts'
import database from './database.ts'
import filesystems from './filesystems.ts'
import logging from './logging.ts'
import session from './session.ts'

export default { app, cache, database, filesystems, logging, session } satisfies ConfigFiles
