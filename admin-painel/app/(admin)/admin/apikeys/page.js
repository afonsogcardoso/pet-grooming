import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ApiKeysClient from './ApiKeysClient'

export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  const cookieStore = await cookies()
  const token = readAccessToken(cookieStore)
  if (!token) redirect('/login?adminError=no_session')

  const profile = await fetchProfile(token)
  if (!profile?.platformAdmin) redirect('/login?adminError=forbidden')

  return <ApiKeysClient currentUserEmail={profile?.email || ''} />
}

function readAccessToken(cookieStore) {
  const token = cookieStore.get('admin_access_token')?.value || null
  return token || null
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
