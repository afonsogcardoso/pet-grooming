'use client'

import Link from 'next/link'
import Image from 'next/image'
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

const navCards = [
  {
    key: 'appointments',
    href: '/appointments',
    icon: '📅',
    titleKey: 'portal.landing.nav.appointments.title',
    descriptionKey: 'portal.landing.nav.appointments.description'
  },
  {
    key: 'customers',
    href: '/customers',
    icon: '👥',
    titleKey: 'portal.landing.nav.customers.title',
    descriptionKey: 'portal.landing.nav.customers.description'
  },
  {
    key: 'services',
    href: '/services',
    icon: '🧴',
    titleKey: 'portal.landing.nav.services.title',
    descriptionKey: 'portal.landing.nav.services.description'
  }
]

export default function PortalLanding({ account, isAuthenticated = false }) {
  const { t } = useTranslation()
  const background = account.brand_background || '#fdfcf9'
  const formattedPhone = formatPhone(account.support_phone)

  const cta = isAuthenticated
    ? { href: '/appointments', label: t('portal.landing.ctaAuthenticated') }
    : { href: `/portal/${account.slug}/login`, label: t('portal.landing.cta') }

  const availableNavCards = isAuthenticated ? navCards : []

  return (
    <div className="min-h-screen" style={{ backgroundColor: background }}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <section
          className="flex flex-1 flex-col justify-center gap-6 px-6 py-12 text-white sm:py-14 lg:px-12"
          style={gradientStyle(account)}
        >
          <div className="flex items-center gap-4">
            {account.logo_url && (
              <Image
                src={account.logo_url}
                alt={t('portal.landing.logoAlt', { name: account.name })}
                width={64}
                height={64}
                sizes="(max-width: 768px) 64px, 80px"
                className="h-16 w-16 rounded-full border-2 border-white/60 object-cover bg-white/20 shadow-lg"
                unoptimized
              />
            )}
            <div>
              <p className="text-sm uppercase tracking-widest text-white/80">
                {t('portal.landing.badge')}
              </p>
              <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{account.name}</h1>
            </div>
          </div>
          <p className="max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {t('portal.landing.description', { name: account.name })}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={cta.href}
              className="w-full rounded-full bg-white px-6 py-3 text-center text-base font-semibold text-slate-900 shadow-lg transition hover:translate-y-0.5 sm:w-auto sm:px-8"
            >
              {cta.label}
            </Link>
          </div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">
            {t('portal.landing.securityBadge', { name: account.name })}
          </p>
        </section>
        {isAuthenticated && (
          <section className="flex flex-1 flex-col justify-center rounded-t-3xl bg-white px-6 py-10 shadow-inner sm:rounded-none sm:bg-white/90 sm:px-8 sm:py-12 lg:px-12">
            <div className="space-y-2 text-slate-800">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t('portal.landing.nav.title')}
              </p>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                {t('portal.landing.nav.subtitle')}
              </h2>
              <p className="text-sm text-slate-600 sm:text-base">
                {t('portal.landing.nav.description')}
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {availableNavCards.map((card) => (
                <Link
                  key={card.key}
                  href={card.href}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 sm:p-5"
                >
                  <div className="text-2xl">{card.icon}</div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-900">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-sm text-slate-600">{t(card.descriptionKey)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
