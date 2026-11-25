// Sign-in features, read by @strutvane/auth (Fortify + Sanctum for Strutvane). Change them here,
// not in .env: APP_KEY is the one root secret, and every signing and encryption key is derived
// from it. Plain data on purpose, so the file loads without the auth package and the installer
// can write your answers into it.
//
// Feature names are the same everywhere (installer, this file, docs, routes):
// password, emailLink, registration, emailVerification, passwordReset (always on with
// passwords), passwordConfirmation, twoFactor, passkeys, apiTokens, teams, impersonation.
//
// Roles: what each role may do, on top of the policies in app/policies (a policy's deny always
// wins). Every role says where it is held:
// - scope 'global': a platform role, held outside teams. `admin` is the platform administrator
//   (the first admin from `npm run setup`) and is never a team role.
// - scope 'tenant': a team role, held inside one team. With teams on, the person who creates a
//   team holds the reserved `owner` role there (never a platform role), and the people they
//   invite hold your team roles, for example:
//     owner: { scope: 'tenant', permissions: ['*'] },
//     member: { scope: 'tenant', permissions: ['*.viewAny', '*.view'] },
// A role without a scope is a platform role. Inside a team, `*` patterns only reach team data
// (models with a tenantId column), and never the wildcardExclude records below.
export default {
  features: {
    password: true,
    emailLink: false,
    // Public sign-up stays off: B2B apps are invite-only unless you decide otherwise.
    registration: false,
    emailVerification: true,
    passwordReset: true,
    passwordConfirmation: true,
    twoFactor: true,
    passkeys: false,
    apiTokens: true,
    teams: false,
    impersonation: false,
  },
  roles: {
    admin: {
      scope: 'global',
      permissions: ['*', 'user.viewAny', 'user.view', 'user.update', 'user.delete'],
    },
    member: {
      scope: 'global',
      permissions: [
        '*.viewAny',
        '*.view',
        '*.create',
        { action: '*.update', own: true },
        { action: '*.delete', own: true },
      ],
    },
  },
  // Records no `*` pattern ever reaches: identity, machine access, authorization, teams and
  // audit. Grant them by exact name ('user.view'). Complete on purpose, even for features that
  // are off, so the protection is already there when you turn them on.
  wildcardExclude: [
    'user',
    'account',
    'session',
    'verification',
    'mfaFactor',
    'passkey',
    'impersonationSession',
    'apiToken',
    'serviceAccount',
    'oauthClient',
    'ssoConnection',
    'scimToken',
    'role',
    'rolePermission',
    'roleInherit',
    'assignment',
    'permission',
    'tenant',
    'tenantDomain',
    'membership',
    'invitation',
    'team',
    'teamMember',
    'auditEvent',
  ],
  // Models no role names are covered by the `*` patterns. 'admin-only' is the stricter choice.
  newModelDefaults: 'inherit-role-patterns',
  // Platform roles every new account gets: none, so sign-up never hands out access.
  defaultRoles: [],
}
