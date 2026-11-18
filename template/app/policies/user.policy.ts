// Who may do what with users. Found by name: the User model uses app/policies/user.policy.ts.
//
// Deny by default: a missing method refuses, so this policy only lets people see their own
// record. Changing a user (email, verification, password) goes through the sign-in flows of
// @strutvane/auth, which re-verify; admin-wide grants come from its role map (config/auth.ts).
import type { AuthUser } from '@strutvane/framework'
import type { User } from '../models/user.ts'

export default class UserPolicy {
  view(actor: AuthUser | null, user: User): boolean {
    return actor !== null && String(actor.id) === String(user.id)
  }
}
