import { notFound } from 'next/navigation'
import { getPublicAccountBySlug } from '@/lib/publicAccounts'
import PortalLanding from '@/components/portal/PortalLanding'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function generateMetadata({ params }) {
  const { slug } = await params
  const account = await getPublicAccountBySlug(slug?.toLowerCase())

  if (!account) {
    return {
      title: 'Booking',
      description: 'Agende online com facilidade.'
    }
  }

  const title = `${account.name} · Marcação online`
  const description = `Reserve serviços em ${account.name}.`
  const image = account.portal_image_url || account.logo_url || '/brand-logo.png'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: image ? [image] : undefined
    }
  }
}

export default async function BookingLandingPage({ params }) {
  const { slug } = await params
  const slugParam = slug?.toLowerCase()
  const account = await getPublicAccountBySlug(slugParam)

  if (!account) {
    notFound()
  }
  const cookieStore = await cookies()
  const isAuthenticated = Boolean(readAccessToken(cookieStore))

  return <PortalLanding account={account} isAuthenticated={isAuthenticated} />
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
