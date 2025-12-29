"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import ProfileMetadataForm from '@/components/ProfileMetadataForm'
import ResetPasswordForm from '@/components/ResetPasswordForm'
import { useTranslation } from '@/components/TranslationProvider'
import { formatPhoneDisplay } from '@/lib/phone'
import { getStoredAccessToken } from '@/lib/authTokens'

function formatDate(value, locale, options = { dateStyle: 'medium' }) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(value))
  } catch {
    return value
  }
}

export default function ProfilePageClient({ user, memberships = [], membershipCount = 0 }) {
  const { t, resolvedLocale } = useTranslation()
  const tabs = [
    { id: 'profile', label: t('profile.tabs.profile') || 'Perfil' },
    { id: 'security', label: t('profile.tabs.security') || 'Segurança' },
    { id: 'memberships', label: t('profile.tabs.memberships') || 'Associações' }
  ]
  const [activeTab, setActiveTab] = useState('profile')
  const metadata = user?.user_metadata || {}
  const appMetadata = user?.app_metadata || {}
  const displayName = metadata.display_name || user?.email
  const phone = formatPhoneDisplay(metadata.phone) || '—'
  const locale = metadata.preferred_locale || 'pt'
  const avatarUrl = metadata.avatar_url || ''
  const linkedProviders = new Set(
    [
      ...(Array.isArray(appMetadata.providers) ? appMetadata.providers : []),
      appMetadata.provider
    ]
      .filter(Boolean)
      .map((provider) => provider.toString().toLowerCase())
  )
  const isGoogleLinked = linkedProviders.has('google')
  const isAppleLinked = linkedProviders.has('apple')
  const [membershipsList, setMembershipsList] = useState(memberships)
  const [membershipsLoading, setMembershipsLoading] = useState(false)
  const [membershipsError, setMembershipsError] = useState(null)
  const primaryMembership = membershipsList?.[0] || null
  const primaryRole = primaryMembership?.role || t('profile.memberships.roles.member')
  const lastLogin = user?.last_sign_in_at
    ? formatDate(user.last_sign_in_at, resolvedLocale, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
    : t('profile.common.notAvailable')
  const [linkingProvider, setLinkingProvider] = useState(null)
  const [linkStatus, setLinkStatus] = useState(null)

  const loadMemberships = async () => {
    if (membershipsLoading) return
    const token = getStoredAccessToken()
    if (!token) return

    setMembershipsLoading(true)
    setMembershipsError(null)

    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
      const url = base
        ? `${base}/api/v1/profile?includeMemberships=true`
        : '/api/v1/profile?includeMemberships=true'
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        throw new Error('Failed to load memberships')
      }
      const body = await response.json().catch(() => null)
      setMembershipsList(Array.isArray(body?.memberships) ? body.memberships : [])
    } catch (error) {
      setMembershipsError(error)
    } finally {
      setMembershipsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'memberships' && membershipsList.length === 0 && membershipCount > 0) {
      loadMemberships()
    }
  }, [activeTab, membershipCount, membershipsList.length])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const searchParams = new URLSearchParams(url.search)
    const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash)
    const storedProvider = window.sessionStorage?.getItem('linking_provider')
    const provider = storedProvider || searchParams.get('link_provider')
    const returnTo = searchParams.get('return_to')
    const linkStatusParam = searchParams.get('link_status')

    const error =
      searchParams.get('error') ||
      searchParams.get('error_description') ||
      hashParams.get('error') ||
      hashParams.get('error_description')

    const providerLabel = provider
      ? t(`profile.linkSection.providers.${provider}`) || provider
      : ''

    if (linkStatusParam) {
      const isSuccess = linkStatusParam === 'success'
      setLinkStatus({
        type: isSuccess ? 'success' : 'error',
        text: isSuccess
          ? t('profile.linkSection.success', { provider: providerLabel })
          : t('profile.linkSection.errors.failed', { provider: providerLabel })
      })
    } else if (provider) {
      if (error) {
        setLinkStatus({
          type: 'error',
          text: t('profile.linkSection.errors.failed', { provider: providerLabel })
        })
      } else {
        setLinkStatus({
          type: 'success',
          text: t('profile.linkSection.success', { provider: providerLabel })
        })
      }
    }

    window.sessionStorage?.removeItem('linking_provider')

    if (returnTo) {
      try {
        const returnUrl = new URL(returnTo)
        const status = error ? 'error' : 'success'
        if (provider) {
          returnUrl.searchParams.set('link_provider', provider)
        }
        returnUrl.searchParams.set('link_status', status)
        window.history.replaceState({}, '', url.pathname + url.search)
        window.location.assign(returnUrl.toString())
        return
      } catch {
        // ignore invalid return_to
      }
    }

    const hadErrorParams = searchParams.has('error') || searchParams.has('error_description')
    if (hadErrorParams) {
      searchParams.delete('error')
      searchParams.delete('error_description')
    }
    const hadLinkStatus = searchParams.has('link_status')
    const hadLinkProvider = searchParams.has('link_provider')
    const hadReturnTo = searchParams.has('return_to')
    if (hadLinkStatus) {
      searchParams.delete('link_status')
    }
    if (hadLinkProvider) {
      searchParams.delete('link_provider')
    }
    if (hadReturnTo) {
      searchParams.delete('return_to')
    }

    const cleanedSearch = searchParams.toString()
    const nextUrl = cleanedSearch ? `${url.pathname}?${cleanedSearch}` : url.pathname

    if (
      hadErrorParams ||
      hadLinkStatus ||
      hadLinkProvider ||
      hadReturnTo ||
      hashParams.has('access_token') ||
      hashParams.has('error') ||
      hashParams.has('error_description')
    ) {
      window.history.replaceState({}, '', nextUrl)
    }
  }, [t])

  const handleLinkProvider = async (provider) => {
    if (linkingProvider || linkedProviders.has(provider)) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const token = getStoredAccessToken()
    const providerLabel = t(`profile.linkSection.providers.${provider}`) || provider

    if (!supabaseUrl || !supabaseAnonKey || !token || typeof window === 'undefined') {
      setLinkStatus({
        type: 'error',
        text: t('profile.linkSection.errors.missing')
      })
      return
    }

    setLinkingProvider(provider)
    setLinkStatus(null)

    const currentUrl = new URL(window.location.href)
    const redirectOrigin =
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_BASE || currentUrl.origin
    const redirectUrl = new URL('/profile', redirectOrigin)
    if (redirectOrigin !== currentUrl.origin) {
      redirectUrl.searchParams.set('return_to', currentUrl.toString())
      redirectUrl.searchParams.set('link_provider', provider)
    }
    redirectUrl.searchParams.delete('error')
    redirectUrl.searchParams.delete('error_description')

    const scopes = provider === 'apple' ? '&scopes=name%20email' : ''
    const requestUrl = `${supabaseUrl}/auth/v1/user/identities/authorize?provider=${provider}&redirect_to=${encodeURIComponent(
      redirectUrl.toString()
    )}&skip_http_redirect=true${scopes}`

    try {
      const response = await fetch(requestUrl, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      })

      if (!response.ok) {
        setLinkStatus({
          type: 'error',
          text: t('profile.linkSection.errors.failed', { provider: providerLabel })
        })
        return
      }

      const body = await response.json().catch(() => null)
      const url = body?.url

      if (!url) {
        setLinkStatus({
          type: 'error',
          text: t('profile.linkSection.errors.failed', { provider: providerLabel })
        })
        return
      }

      if (redirectOrigin === currentUrl.origin) {
        window.sessionStorage?.setItem('linking_provider', provider)
      }
      window.location.assign(url)
    } catch {
      setLinkStatus({
        type: 'error',
        text: t('profile.linkSection.errors.failed', { provider: providerLabel })
      })
    } finally {
      setLinkingProvider(null)
    }
  }

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
            <InfoPill label={t('profile.memberships.title')} value={membershipCount || membershipsList.length || 0} />
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
            <div className="space-y-4">
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

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-base font-semibold text-slate-900">
                  {t('profile.linkSection.title')}
                </h3>
                <p className="text-xs text-slate-600">
                  {t('profile.linkSection.description')}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className={`group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-md ${linkingProvider || isGoogleLinked ? 'cursor-not-allowed opacity-60' : ''}`}
                    onClick={() => handleLinkProvider('google')}
                    disabled={Boolean(linkingProvider) || isGoogleLinked}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <Image
                        src="/icons/google.svg"
                        alt=""
                        width={16}
                        height={16}
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="flex flex-col items-start">
                      <span>
                        {isGoogleLinked
                          ? t('profile.linkSection.providers.google')
                          : t('profile.linkSection.actions.google')}
                      </span>
                      {linkingProvider === 'google' ? (
                        <span className="text-[11px] font-semibold text-slate-500">
                          {t('profile.linkSection.actions.linking')}
                        </span>
                      ) : (
                        isGoogleLinked && (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            {t('profile.linkSection.status.linked')}
                          </span>
                        )
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-md ${linkingProvider || isAppleLinked ? 'cursor-not-allowed opacity-60' : ''}`}
                    onClick={() => handleLinkProvider('apple')}
                    disabled={Boolean(linkingProvider) || isAppleLinked}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                      <Image
                        src="/icons/apple.svg"
                        alt=""
                        width={16}
                        height={16}
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="flex flex-col items-start">
                      <span>
                        {isAppleLinked
                          ? t('profile.linkSection.providers.apple')
                          : t('profile.linkSection.actions.apple')}
                      </span>
                      {linkingProvider === 'apple' ? (
                        <span className="text-[11px] font-semibold text-slate-500">
                          {t('profile.linkSection.actions.linking')}
                        </span>
                      ) : (
                        isAppleLinked && (
                          <span className="text-[11px] font-semibold text-emerald-600">
                            {t('profile.linkSection.status.linked')}
                          </span>
                        )
                      )}
                    </span>
                  </button>
                </div>
                {linkStatus && (
                  <p
                    className={`mt-3 text-xs font-semibold ${linkStatus.type === 'success'
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                      }`}
                  >
                    {linkStatus.text}
                  </p>
                )}
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
                  {membershipCount || membershipsList.length || 0}
                </span>
              </div>
              {membershipsLoading ? (
                <p className="mt-3 text-sm text-slate-500">{t('profile.memberships.loading') || 'Loading...'}</p>
              ) : membershipsError ? (
                <p className="mt-3 text-sm text-rose-600">{t('profile.memberships.error') || 'Failed to load.'}</p>
              ) : !membershipsList?.length ? (
                <p className="mt-3 text-sm text-slate-500">{t('profile.memberships.empty')}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {membershipsList.map((entry) => (
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
