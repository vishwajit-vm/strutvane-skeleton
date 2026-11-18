// Sign-in features, read by @strutvane/auth (Fortify + Sanctum for Strutvane). Change them here,
// not in .env: APP_KEY is the one root secret, and every signing and encryption key is derived
// from it. Plain data on purpose, so the file loads without the auth package and the installer
// can write your answers into it.
//
// Feature names are the same everywhere (installer, this file, docs, routes):
// password, emailLink, registration, emailVerification, passwordReset (always on with
// passwords), passwordConfirmation, twoFactor, passkeys, apiTokens, teams, impersonation.
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
}
