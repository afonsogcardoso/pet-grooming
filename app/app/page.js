import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export default async function RootRedirect() {
  const cookieStore = await cookies()
  const token = readAccessToken(cookieStore)
  if (!token) redirect('/login')

  const profile = await fetchProfile(token)
  if (!profile) redirect('/login')

  let targetSlug = null
  const memberships = profile.memberships || []
  if (memberships.length) {
    targetSlug = memberships[0]?.account?.slug || null
  }

  if (!targetSlug) {
    redirect('/appointments')
  }

  redirect(`/portal/${targetSlug}`)
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

async function fetchProfile(token) {
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/v1/profile` : '/api/v1/profile'

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
