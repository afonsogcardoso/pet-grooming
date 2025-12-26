"use client"

import { useState } from 'react'
import ProfileMetadataForm from '@/components/ProfileMetadataForm'
import ResetPasswordForm from '@/components/ResetPasswordForm'
import { useTranslation } from '@/components/TranslationProvider'
import { formatPhoneDisplay } from '@/lib/phone'

function formatDate(value, locale, options = { dateStyle: 'medium' }) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(value))
  } catch {
    return value
  }
}

export default function ProfilePageClient({ user, memberships = [] }) {
  const { t, resolvedLocale } = useTranslation()
  const tabs = [
    { id: 'profile', label: t('profile.tabs.profile') || 'Perfil' },
    { id: 'security', label: t('profile.tabs.security') || 'Segurança' },
    { id: 'memberships', label: t('profile.tabs.memberships') || 'Associações' }
  ]
  const [activeTab, setActiveTab] = useState('profile')
  const metadata = user?.user_metadata || {}
  const displayName = metadata.display_name || user?.email
  const phone = formatPhoneDisplay(metadata.phone) || '—'
  const locale = metadata.preferred_locale || 'pt'
  const avatarUrl = metadata.avatar_url || ''
  const primaryMembership = memberships?.[0] || null
  const primaryRole = primaryMembership?.role || t('profile.memberships.roles.member')
  const lastLogin = user?.last_sign_in_at
    ? formatDate(user.last_sign_in_at, resolvedLocale, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    : t('profile.common.notAvailable')

  if (!user) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">{t('profile.page.title')}</h1>
        <p className="text-slate-600">{t('profile.page.requiresAuth')}</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-primary via-brand-primary to-slate-900 text-white shadow-md">
        <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-xl bg-white/15 border border-white/25 shadow-inner overflow-hidden flex items-center justify-center text-lg font-bold">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                displayName?.charAt(0)?.toUpperCase() || '👤'
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">
                {t('profile.page.sectionLabel')}
              </p>
              <h1 className="text-xl font-semibold leading-tight">{displayName}</h1>
              <p className="text-sm text-white/80">{user.email}</p>
              <p className="text-[11px] text-white/70">
                {t('profile.page.lastLogin', { value: lastLogin })}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:w-auto md:min-w-[280px] text-sm">
            <InfoPill label={t('profile.basics.labels.createdAt')} value={formatDate(user.created_at, resolvedLocale)} />
            <InfoPill label={t('profile.memberships.title')} value={memberships.length || 0} />
            <InfoPill label={t('profile.memberships.headers.role')} value={t(`profile.memberships.roles.${primaryRole}`) || primaryRole} />
            <InfoPill label={t('profile.form.phoneLabel')} value={phone} />
            <InfoPill label={t('profile.form.localeLabel')} value={locale} />
          </div>
        </div>
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id
                  ? 'bg-brand-primary text-white shadow-brand-glow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {activeTab === 'profile' && t('profile.tabs.profile')}
            {activeTab === 'security' && t('profile.tabs.security')}
            {activeTab === 'memberships' && t('profile.tabs.memberships')}
          </span>
        </div>

        <div className="mt-4">
          {activeTab === 'profile' && (
            <ProfileMetadataForm
              initialDisplayName={metadata.display_name || ''}
              initialPhone={metadata.phone || ''}
              initialLocale={metadata.preferred_locale || 'pt'}
              initialAvatarUrl={avatarUrl}
            />
          )}

          {activeTab === 'security' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">
                {t('profile.passwordSection.title')}
              </h3>
              <p className="text-xs text-slate-600">
                {t('profile.passwordSection.description')}
              </p>
              <div className="mt-3">
                <ResetPasswordForm />
              </div>
            </div>
          )}

          {activeTab === 'memberships' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  {t('profile.memberships.title')}
                </h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                  {memberships.length || 0}
                </span>
              </div>
              {!memberships?.length ? (
                <p className="mt-3 text-sm text-slate-500">{t('profile.memberships.empty')}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {memberships.map((entry) => (
                    <div
                      key={`${entry.account_id}-${entry.role}`}
                      className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {entry.account?.name || t('profile.memberships.fallbackAccount')}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {entry.account?.slug || entry.account_id}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {t('profile.memberships.headers.since')}: {formatDate(entry.created_at, resolvedLocale)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                          {t(`profile.memberships.roles.${entry.role}`)}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          {t('profile.memberships.headers.status')}: {t(`profile.memberships.status.${entry.status}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function InfoPill({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-white/70">{label}</p>
      <p className="text-sm font-semibold text-white">{value || '—'}</p>
    </div>
  )
}
