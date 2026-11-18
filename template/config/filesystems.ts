// File storage disks (Laravel's config/filesystems.php). Relative roots resolve against the
// project root, never the working directory.
//
// - `local`: private files in storage/app. Hand them out with signed, expiring links.
// - `public`: files anyone may read, in storage/app/public (`node strut storage:link` exposes it).
//
// Cloud disks (S3 and compatible) come from `@strutvane/files` (`node strut install:files`);
// their bucket and keys live only in .env.
import { defineConfig } from '@strutvane/framework'

export default defineConfig((env) => ({
  /** The disk `Storage.put()` uses when none is named. */
  default: env.string('FILESYSTEM_DISK', 'local'),
  disks: {
    local: { driver: 'local', root: 'storage/app', visibility: 'private' },
    public: {
      driver: 'local',
      root: 'storage/app/public',
      visibility: 'public',
      url: `${env.url('APP_URL', 'http://localhost:3000')}/storage`,
    },
  },
}))
