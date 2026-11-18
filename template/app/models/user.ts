import { Model } from '@strutvane/framework/database'

/**
 * The `users` table. Its columns come from the migrations (`node strut migrate` regenerates the
 * types in .strutvane/types), so they are never repeated here. Add relations, scopes and
 * accessors in the class.
 */
export class User extends Model('users', {
  // The columns a request may set with User.create(…) / fill(…). Everything else is refused.
  fillable: ['name', 'email'],
  // Never serialised into API responses or logs.
  hidden: ['password', 'remember_token'],
}) {}
