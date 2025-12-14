'use client'

import Link from 'next/link'
import Image from 'next/image'
import TenantLoginForm from '@/components/tenant/TenantLoginForm'
import { useTranslation } from '@/components/TranslationProvider'

function gradientStyle(account) {
  if (account?.brand_gradient) {
    return { backgroundImage: account.brand_gradient }
  }
  if (account?.brand_primary && account?.brand_accent) {
    return {
      backgroundImage: `linear-gradient(135deg, ${account.brand_primary}, ${account.brand_accent})`
    }
  }
  return {
    backgroundImage: 'linear-gradient(135deg, #4fafa9, #7a5af8)'
  }
}

function formatPhone(value) {
  if (!value) return null
  const digits = value.replace(/[^0-9]/g, '')
  return digits.length ? digits : null
}

export default function PortalLoginLayout({ account }) {
  const { t } = useTranslation()
  const supportEmail = account.support_email || 'afonso@mstudio.pt'
  const whatsappNumber = formatPhone(account.support_phone)
  const supportHref = whatsappNumber ? `https://wa.me/${whatsappNumber}` : `mailto:${supportEmail}`
  const supportLabel = whatsappNumber ? t('portal.landing.contactWhatsApp') : supportEmail

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden"
      style={{ backgroundColor: account.brand_background || '#fdfcf9' }}
    >
      <div className="absolute inset-0 md:hidden" style={gradientStyle(account)} />
      <div className="absolute inset-0 md:hidden bg-black/25" />
      <div className="relative flex-1 grid md:grid-cols-5 md:h-screen">
        <div className="hidden md:block md:col-span-3 relative">
          <div className="absolute inset-0" style={gradientStyle(account)} />
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
            <div>
              <Link href={`/portal/${account.slug}`} className="block group">
                <p className="text-sm uppercase tracking-widest text-white/70">
                  {t('portal.loginPage.badge')}
                </p>
                <h1 className="text-4xl font-bold mt-2 group-hover:underline">{account.name}</h1>
              </Link>
              <p className="mt-4 text-lg text-white/90 max-w-lg">
                {t('portal.loginPage.description', { name: account.name })}
              </p>
              {account.portal_image_url && (
                <div className="mt-6 rounded-3xl overflow-hidden border border-white/30 shadow-2xl bg-white/10 backdrop-blur">
                  <Image
                    src={account.portal_image_url}
                    alt={t('portal.loginPage.imageAlt', { name: account.name })}
                    width={1200}
                    height={400}
                    className="h-64 w-full object-cover"
                    priority={false}
                    unoptimized
                  />
                </div>
              )}
            </div>
            <div className="space-y-4">
              <Link
                href={`/portal/${account.slug}`}
                className="flex items-center gap-4 group"
              >
                {account.logo_url && (
                  <Image
                    src={account.logo_url}
                    alt={t('portal.landing.logoAlt', { name: account.name })}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full border-2 border-white/60 object-cover bg-white/20"
                    unoptimized
                  />
                )}
                <div>
                  <p className="text-sm uppercase tracking-widest text-white/70">
                    {t('portal.loginPage.slugLabel')}
                  </p>
                  <p className="text-2xl font-semibold group-hover:underline">{account.slug}</p>
                </div>
              </Link>
              <p className="text-sm text-white/70">
                {t('portal.loginPage.supportPrefix')}{' '}
                <a href={supportHref} className="underline font-semibold" target="_blank" rel="noreferrer">
                  {supportLabel}
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 flex items-center justify-center px-6 py-12">
          <TenantLoginForm account={account} />
        </div>
      </div>
    </div>
  )
}
