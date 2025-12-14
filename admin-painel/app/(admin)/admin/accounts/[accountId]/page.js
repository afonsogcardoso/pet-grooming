import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AccountManageClient from './AccountManageClient'

export const dynamic = 'force-dynamic'

export default async function AccountManagePage({ params }) {
  const accountId = params?.accountId
  const cookieStore = await cookies()
  const token = readAccessToken(cookieStore)
  if (!token) {
    redirect('/admin/login?adminError=no_session')
  }

  const profile = await fetchProfile(token)
  if (!profile?.platformAdmin) {
    redirect('/admin/login?adminError=forbidden')
  }

  const account = await fetchAccount(accountId, token)

  if (!account) {
    return <div className="p-6 text-red-700">Account not found.</div>
  }

  return <AccountManageClient account={account} />
}

function readAccessToken(cookieStore) {
  const token = cookieStore.get('admin_access_token')?.value || null
  return token || null
}

async function fetchAccount(accountId, token) {
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/v1/admin/accounts/${accountId}` : `/api/v1/admin/accounts/${accountId}`
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    })
    if (!response.ok) return null
    const body = await response.json().catch(() => null)
    return body?.account || null
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
