import ConfirmationPage from '@/components/ConfirmationPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const runtime = 'edge'

function buildAbsoluteUrl(path) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  if (!path) return null
  if (path.startsWith('http')) return path
  if (siteUrl) {
    return `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  }
  return path
}

async function fetchAppointmentWithToken(id, token) {
  if (!id || !token) return { appointment: null }
  const base = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
  const url = `${base}/api/v1/appointments/confirm?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`
  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) return { appointment: null }
    const body = await res.json().catch(() => ({}))
    return { appointment: body.appointment || null }
  } catch (error) {
    console.error('Failed to load appointment for confirmation', error)
    return { appointment: null }
  }
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams
  const id = params?.id || null
  const token = params?.token || null
  const { appointment } = await fetchAppointmentWithToken(id, token)

  const title = 'Confirmação de reserva'
  const description = 'Veja os detalhes da sua marcação.'

  const ogCandidate =
    appointment?.accounts?.portal_image_url ||
    appointment?.accounts?.logo_url ||
    null
  const ogImage = buildAbsoluteUrl(ogCandidate)

  return {
    title,
    description,
    openGraph: { title, description, images: ogImage ? [ogImage] : undefined },
    twitter: { card: 'summary', title, description, images: ogImage ? [ogImage] : undefined }
  }
}

export default async function AppointmentConfirmationPage({ searchParams }) {
  const params = await searchParams
  const id = params?.id || null
  const token = params?.token || null

  const { appointment } = await fetchAppointmentWithToken(id, token)

  return <ConfirmationPage appointment={appointment} />
}
