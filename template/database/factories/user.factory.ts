import { defineFactory } from '@strutvane/framework/database'
import { User } from '../../app/models/user.ts'

/**
 * Fake users for seeders and tests: `UserFactory.count(10).create()`. No password is set, so a
 * fake user can never sign in.
 */
export default defineFactory(User, ({ faker, sequence }) => ({
  name: faker.name(),
  email: `user${sequence}@example.test`,
}))
