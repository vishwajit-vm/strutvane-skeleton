import { defineSeeder } from '@strutvane/framework/database'
import UserFactory from '../factories/user.factory.ts'

/**
 * Sample users for local development, so screens are not empty on day one. Seeders never run in
 * production unless you pass `--force`. Your real first admin is created by `npm run setup`
 * (with @strutvane/auth), never from a password in a file.
 */
export default defineSeeder({
  async run({ env }) {
    if (env === 'production' || env === 'staging') return
    await UserFactory.count(5).create()
  },
})
