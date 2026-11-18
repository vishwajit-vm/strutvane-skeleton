// Sessions (Laravel's config/session.php). The cookie is always HttpOnly and SameSite=Lax; on
// https it is also Secure and gets the __Host- prefix (from APP_URL), so nothing here can weaken
// it.
import { defineConfig } from '@strutvane/framework'

export default defineConfig((env) => ({
  /** Where sessions are stored: `file` keeps them in storage/framework/sessions. */
  driver: env.oneOf('SESSION_DRIVER', ['file'], 'file'),
  /** Idle minutes before a session expires. */
  lifetime: env.integer('SESSION_LIFETIME', 120),
  /**
   * The cookie's name, without the __Host- prefix (letters, digits and _-.). Give each app on one
   * domain its own name.
   */
  cookie: env.string('SESSION_COOKIE', '{{APP_SLUG}}_session'),
}))
