import { defineSeeder } from '@strutvane/framework/database'
import UserSeeder from './user.seeder.ts'

/**
 * Seeds the database (`node strut db:seed`). `node strut make:migration … --seeder` adds each
 * new seeder to the list between the markers, after the seeders of the tables it depends on.
 * Everything outside the markers is yours.
 */
export default defineSeeder({
  async run({ call }) {
    // strut:seeders:start
    await call([UserSeeder])
    // strut:seeders:end
  },
})
