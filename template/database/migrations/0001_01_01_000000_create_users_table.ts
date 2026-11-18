import { migration } from '@strutvane/framework/schema'

// The users table every app starts with. Migrations are the source of truth for your schema: add
// columns with a new migration (`node strut make:migration add_phone_to_users_table`), never by
// editing one that has already run.
//
// Sessions and the cache live in files (storage/framework) by default, so they need no tables.
// Sign-in tables (tokens, two-factor, passkeys, teams) are added by `node strut install:auth`.
export default migration({
  up(schema) {
    schema.create('users', (t) => {
      t.id()
      t.string('name')
      t.string('email').unique()
      t.timestamp('email_verified_at').nullable()
      // Nullable: users created by email-link sign-in or an invitation have no password yet.
      t.string('password').nullable()
      t.string('remember_token', 100).nullable()
      t.timestamps()
    })
  },
  down(schema) {
    schema.dropIfExists('users')
  },
})
