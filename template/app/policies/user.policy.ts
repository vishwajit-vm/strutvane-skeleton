// Who may do what with users. Found by name: the User model uses app/policies/user.policy.ts.
//
// One policy style for the whole app: a class with Laravel's methods (viewAny, view, create,
// update, delete, before), checked by the framework's gate and ResourceController. It is what
// `node strut make:migration` writes for every new table, and @strutvane/auth loads next to it
// (auth's own `definePolicy` rules, compiled to SQL, can sit in this folder too).
//
// Deny by default: a missing method refuses, so this policy only lets people see their own
// record. Changing a user (email, verification, password) goes through the sign-in flows of
// @strutvane/auth, which re-verify.
import type { AuthUser } from '@strutvane/framework'
import type { User } from '../models/user.ts'

export default class UserPolicy {
  view(actor: AuthUser | null, user: User): boolean {
    return actor !== null && String(actor.id) === String(user.id)
  }
}
