import { notFound } from 'next/navigation'
import { getPublicAccountBySlug } from '@/lib/publicAccounts'
import PortalLoginLayout from '@/components/portal/PortalLoginLayout'

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function generateMetadata({ params }) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.toLowerCase()
  const account = await getPublicAccountBySlug(slug)

  if (!account) {
    return {
      title: 'Entrar',
      description: 'Área reservada'
    }
  }

  const title = `${account.name} · Entrar`
  const description = `Aceda à área reservada de ${account.name}.`
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

export default async function TenantLoginPage({ params }) {
  const { slug: rawSlug } = await params
  const slug = rawSlug?.toLowerCase()
  const account = await getPublicAccountBySlug(slug)

  if (!account) {
    notFound()
  }

  return <PortalLoginLayout account={account} />
}
