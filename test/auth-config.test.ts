/**
 * The rendered `config/auth.ts`: the sign-in switches and the role map a new app starts with.
 *
 * Why these checks: from @strutvane/auth 0.2.0-next.2 a role map entry without a `scope` is a
 * PLATFORM role, team (tenant) roles must say `scope: 'tenant'`, the team creator holds the
 * reserved `owner` role (never a platform role) and `admin` is platform-only. The boot refuses a
 * map that breaks those rules, so a template that drifts from them would ship apps that do not
 * start, or that hand a team role platform grants. The rules below mirror auth's
 * `compileRoleMap` / `partitionRoles` (auth `src/policy/roles.ts`); the skeleton cannot import
 * auth itself (nothing here depends on unpublished packages).
 */
import { describe, expect, it } from 'vitest'
import { resolveAnswers } from '../src/manifest.ts'
import { type RenderedFile, renderSkeleton } from '../src/render.ts'
import authConfig from '../template/config/auth.ts'
import tenancyConfig from '../template/config/tenancy.ts'
import { manifest, ROOT, templateText } from './helpers.ts'

type Scope = 'global' | 'tenant' | 'any'
type Permission =
  | string
  | { readonly action: string; readonly own?: boolean; readonly scope?: Scope }
interface Role {
  readonly scope?: Scope
  readonly permissions: readonly Permission[]
}

const render = (given: Readonly<Record<string, string>> = {}): RenderedFile[] =>
  renderSkeleton({ root: ROOT, manifest, answers: resolveAnswers(manifest, given) })

const roles: Readonly<Record<string, Role>> = authConfig.roles as Readonly<Record<string, Role>>
const actionOf = (permission: Permission): string =>
  typeof permission === 'string' ? permission : permission.action

/** The exclusion list of the hub's docs/07 §4.4: every identity, access, tenancy and audit record. */
const PROTECTED = [
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
]

describe('config/auth.ts (Recommended answers)', () => {
  it('is rendered verbatim for every sign-in answer, and not at all without sign-in', () => {
    for (const auth of ['email', 'magic-link']) {
      const file = render({ auth }).find((candidate) => candidate.path === 'config/auth.ts')
      expect(file?.content, auth).toBe(templateText('config/auth.ts'))
    }
    expect(render({ auth: 'none' }).map((file) => file.path)).not.toContain('config/auth.ts')
  })

  it('keeps teams and public registration explicitly off, like config/tenancy.ts', () => {
    expect(authConfig.features.teams).toBe(false)
    expect(authConfig.features.registration).toBe(false)
    expect(tenancyConfig.enabled).toBe(false)
  })

  it('gives every role an explicit scope (a missing one would silently mean platform)', () => {
    for (const [name, role] of Object.entries(roles))
      expect(['global', 'tenant'], `roles.${name}.scope`).toContain(role.scope)
  })

  it('keeps admin a platform role and never makes owner one', () => {
    expect(roles['admin']?.scope).toBe('global')
    // owner is the team creator's reserved role: tenant-only when present (teams on).
    if (roles['owner'] !== undefined) expect(roles['owner'].scope).toBe('tenant')
  })

  it('has no team roles while teams are off', () => {
    expect(Object.entries(roles).filter(([, role]) => role.scope !== 'global')).toEqual([])
  })

  it('never gives a permission a scope its role does not have (auth refuses that at boot)', () => {
    for (const [name, role] of Object.entries(roles))
      for (const permission of role.permissions)
        if (typeof permission !== 'string' && permission.scope !== undefined)
          expect(permission.scope, `roles.${name}: ${permission.action}`).toBe(role.scope)
  })

  it('only uses well-formed permission patterns', () => {
    const pattern = /^(\*|(\*|[a-z][a-zA-Z0-9_-]*)\.(\*|[a-zA-Z][a-zA-Z0-9_-]*))$/
    for (const [name, role] of Object.entries(roles)) {
      expect(role.permissions.length, `roles.${name}`).toBeGreaterThan(0)
      for (const permission of role.permissions)
        expect(actionOf(permission), `roles.${name}`).toMatch(pattern)
    }
  })

  it('keeps identity, access, team and audit records out of every wildcard', () => {
    expect([...authConfig.wildcardExclude].sort()).toEqual([...PROTECTED].sort())
    for (const [name, role] of Object.entries(roles))
      for (const permission of role.permissions) {
        const [resource, action] = actionOf(permission).split('.')
        // `user.*` on an excluded resource is a boot error in auth.
        if (resource !== undefined && PROTECTED.includes(resource))
          expect(action, `roles.${name}: ${actionOf(permission)}`).not.toBe('*')
      }
  })

  it('lets only the platform admin manage users, and members change only their own records', () => {
    const grantsOn = (role: Role | undefined, resource: string): string[] =>
      (role?.permissions ?? []).map(actionOf).filter((action) => action.startsWith(`${resource}.`))
    expect(grantsOn(roles['admin'], 'user').sort()).toEqual(
      ['user.delete', 'user.update', 'user.view', 'user.viewAny'].sort(),
    )
    for (const [name, role] of Object.entries(roles)) {
      if (name === 'admin') continue
      expect(grantsOn(role, 'user'), `roles.${name}`).toEqual([])
      for (const permission of role.permissions) {
        const action = actionOf(permission)
        if (action === '*' || action.endsWith('.update') || action.endsWith('.delete'))
          expect(typeof permission !== 'string' && permission.own, `roles.${name}: ${action}`).toBe(
            true,
          )
      }
    }
  })

  it('hands out no platform role by default', () => {
    expect(authConfig.defaultRoles).toEqual([])
    expect(authConfig.newModelDefaults).toBe('inherit-role-patterns')
  })

  it('explains tenant scopes, the owner role and the platform-only admin to the reader', () => {
    const text = templateText('config/auth.ts')
    expect(text).toContain("scope: 'tenant'")
    expect(text).toMatch(/`owner`/)
    expect(text).toMatch(/`admin`.*never a team role/s)
  })
})
