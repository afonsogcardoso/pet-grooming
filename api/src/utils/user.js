const VALID_USER_ROLES = new Set(['consumer', 'provider'])

export function normalizeUserRole(role) {
  return role === 'consumer' ? 'consumer' : role === 'provider' ? 'provider' : null
}

export function parseAvailableRoles(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (entry ? entry.toString().toLowerCase() : null))
    .filter((entry) => entry && VALID_USER_ROLES.has(entry))
}

export function mergeAvailableRoles(existingRoles, ...roles) {
  const merged = [...(existingRoles || [])]
  roles.forEach((role) => {
    if (!role) return
    const normalized = normalizeUserRole(role)
    if (normalized) merged.push(normalized)
  })
  return Array.from(new Set(merged))
}

export function resolveActiveRole({ availableRoles, activeRole }) {
  const normalizedActive = normalizeUserRole(activeRole)
  if (normalizedActive && availableRoles.includes(normalizedActive)) return normalizedActive
  if (availableRoles.includes('provider')) return 'provider'
  if (availableRoles.includes('consumer')) return 'consumer'
  return 'consumer'
}

export function collectAuthProviders(user) {
  if (!user) return []
  const providers = new Set()
  const appMeta = user.app_metadata || {}
  const metaProviders = Array.isArray(appMeta.providers) ? appMeta.providers : []
  metaProviders.forEach((entry) => {
    if (entry) providers.add(entry.toString().toLowerCase())
  })
  if (appMeta.provider) {
    providers.add(appMeta.provider.toString().toLowerCase())
  }
  const identities = Array.isArray(user.identities) ? user.identities : []
  identities.forEach((identity) => {
    if (identity?.provider) {
      providers.add(identity.provider.toString().toLowerCase())
    }
  })
  return Array.from(providers)
}

export function isPlatformAdmin(user) {
  if (!user) return false
  const metadata = user.user_metadata || {}
  const appMeta = user.app_metadata || {}
  const roles = Array.isArray(appMeta.roles) ? appMeta.roles : []
  return (
    metadata.platform_admin === true ||
    metadata.platform_admin === 'true' ||
    appMeta.platform_admin === true ||
    appMeta.platform_admin === 'true' ||
    roles.includes('platform_admin')
  )
}
