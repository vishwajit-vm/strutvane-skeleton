import { defineSeeder } from '@strutvane/framework/database'
import { User } from '../../app/models/user.ts'
import UserFactory from '../factories/user.factory.ts'

/** How many sample users development gets. */
const SAMPLE_USERS = 5

/**
 * Sample users for local development, so screens are not empty on day one. Seeders never run in
 * production unless you pass `--force`. Your real first admin is created by `npm run setup`
 * (with @strutvane/auth), never from a password in a file.
 *
 * Safe to run again (`node strut db:seed` twice): each sample user has a fixed email
 * (user1@example.test … user5@example.test), and one that already exists is left as it is, like
 * Laravel's `firstOrCreate`. Without this a second run stopped at the unique email, and every
 * seeder after this one never ran.
 */
export default defineSeeder({
  async run({ env }) {
    if (env === 'production' || env === 'staging') return
    for (let n = 1; n <= SAMPLE_USERS; n++) {
      const email = `user${n}@example.test`
      if (await User.query().where('email', email).exists()) continue
      await UserFactory.create({ email })
    }
  },
})
