import { redirect } from 'next/navigation'
import ProfilePageClient from '@/components/ProfilePageClient'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const token = readAccessToken(cookieStore)

  if (!token) {
    redirect('/login')
  }

  const profile = await fetchProfile(token)
  if (!profile) {
    redirect('/login')
  }

  const user = mapProfileToUser(profile)
  const memberships = profile.memberships || []
  const membershipCount = profile.membershipCount || memberships.length || 0

  return <ProfilePageClient user={user} memberships={memberships} membershipCount={membershipCount} />
}

function getProjectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  try {
    const host = new URL(url).hostname || ''
    const parts = host.split('.')
    return parts[0] || null
  } catch {
    return null
  }
}

function readAccessToken(cookieStore) {
  const projectRef = getProjectRef()
  const projectCookie = projectRef ? `sb-${projectRef}-auth-token` : null
  const token =
    cookieStore.get('access_token')?.value ||
    cookieStore.get('sb-access-token')?.value ||
    (projectCookie ? cookieStore.get(projectCookie)?.value : null)
  return token || null
}

async function fetchProfile(token) {
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/v1/profile?includeMemberships=false` : '/api/v1/profile?includeMemberships=false'

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store'
  }).catch(() => null)

  if (!response || !response.ok) {
    return null
  }

  const body = await response.json().catch(() => null)
  return body || null
}

function mapProfileToUser(profile) {
  const appMetadata = profile.app_metadata || {}
  const authProviders = Array.isArray(profile.authProviders) ? profile.authProviders : []
  const mergedProviders = Array.from(
    new Set([
      ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
      ...(authProviders || [])
    ])
  ).filter(Boolean)

  return {
    id: profile.id || null,
    email: profile.email || null,
    created_at: profile.createdAt || null,
    last_sign_in_at: profile.lastLoginAt || null,
    app_metadata: {
      ...appMetadata,
      providers: mergedProviders
    },
    user_metadata: {
      display_name: profile.displayName || null,
      phone: profile.phone || null,
      preferred_locale: profile.locale || null,
      avatar_url: profile.avatarUrl || null,
      active_role: profile.activeRole || null,
      available_roles: Array.isArray(profile.availableRoles) ? profile.availableRoles : []
    }
  }
}
