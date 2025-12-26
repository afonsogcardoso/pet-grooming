'use client'

// ============================================
// FILE: app/settings/page.js
// Account branding + member management
// ============================================

import { useEffect, useMemo, useState, useCallback, useRef, useId } from 'react'
import { useAccount } from '@/components/AccountProvider'
import { useTranslation } from '@/components/TranslationProvider'
import { compressImage } from '@/utils/image'
import { getStoredAccessToken } from '@/lib/authTokens'
import { buildPhone, DEFAULT_COUNTRY_CODE, normalizeCountryCode, splitPhone } from '@/lib/phone'
import { COUNTRY_CODES } from '@/lib/countryCodes'

const ROLE_OPTIONS = [
  { value: 'owner', labelKey: 'settings.members.roles.owner' },
  { value: 'admin', labelKey: 'settings.members.roles.admin' },
  { value: 'member', labelKey: 'settings.members.roles.member' }
]

const BRANDING_BUCKET = 'account-branding'
const DEFAULT_BRANDING = {
  brand_primary: '#4fafa9',
  brand_primary_soft: '#e7f8f7',
  brand_accent: '#f4d58d',
  brand_accent_soft: '#fdf6de',
  brand_background: '#fdfcf9',
  brand_gradient: 'linear-gradient(140deg, rgba(79,175,169,0.95), rgba(118,98,78,0.85))'
}

const normalizeBrandingData = (data = {}) => ({
  account_name: data.account_name ?? data.name ?? '',
  logo_url: data.logo_url ?? '',
  portal_image_url: data.portal_image_url ?? '',
  marketplace_region: data.marketplace_region ?? '',
  marketplace_description: data.marketplace_description ?? '',
  marketplace_instagram_url: data.marketplace_instagram_url ?? '',
  marketplace_facebook_url: data.marketplace_facebook_url ?? '',
  marketplace_tiktok_url: data.marketplace_tiktok_url ?? '',
  marketplace_website_url: data.marketplace_website_url ?? '',
  support_email: data.support_email ?? '',
  support_phone: data.support_phone ?? '',
  brand_primary: data.brand_primary ?? '',
  brand_primary_soft: data.brand_primary_soft ?? '',
  brand_accent: data.brand_accent ?? '',
  brand_accent_soft: data.brand_accent_soft ?? '',
  brand_background: data.brand_background ?? '',
  brand_gradient: data.brand_gradient ?? ''
})

const resolveCountryCodeValue = (value, fallback = DEFAULT_COUNTRY_CODE) => {
  if (value === undefined || value === null) return normalizeCountryCode(fallback)
  const trimmed = value.toString().trim()
  if (!trimmed) return normalizeCountryCode(fallback)
  const digits = trimmed.replace(/\D/g, '')
  if (digits) return `+${digits}`
  const match = COUNTRY_CODES.find((entry) => entry.iso === trimmed.toUpperCase())
  return match?.dial || normalizeCountryCode(trimmed, fallback)
}

export default function SettingsPage() {
  const { account, membership, authenticated, refresh } = useAccount()
  const { t, resolvedLocale } = useTranslation()
  const [branding, setBranding] = useState({
    account_name: '',
    logo_url: '',
    portal_image_url: '',
    marketplace_region: '',
    marketplace_description: '',
    marketplace_instagram_url: '',
    marketplace_facebook_url: '',
    marketplace_tiktok_url: '',
    marketplace_website_url: '',
    support_email: '',
    support_phone: '',
    brand_primary: '',
    brand_primary_soft: '',
    brand_accent: '',
    brand_accent_soft: '',
    brand_background: '',
    brand_gradient: ''
  })
  const [supportPhoneCountryCode, setSupportPhoneCountryCode] = useState(DEFAULT_COUNTRY_CODE)
  const [supportPhoneNumber, setSupportPhoneNumber] = useState('')
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [portalImageUploading, setPortalImageUploading] = useState(false)
  const [brandingMessage, setBrandingMessage] = useState(null)
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [membersError, setMembersError] = useState(null)
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', role: 'member' })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMessage, setInviteMessage] = useState(null)
  const [domains, setDomains] = useState([])
  const [domainsLoading, setDomainsLoading] = useState(false)
  const [domainsError, setDomainsError] = useState(null)
  const [domainMessage, setDomainMessage] = useState(null)
  const [domainForm, setDomainForm] = useState({ domain: '', dnsRecordType: 'txt' })
  const [domainSubmitting, setDomainSubmitting] = useState(false)
  const [verifyingDomainId, setVerifyingDomainId] = useState(null)
  const lastMembersAccountIdRef = useRef(null)
  const lastDomainsAccountIdRef = useRef(null)
  const membersFetchInFlight = useRef(false)
  const domainsFetchInFlight = useRef(false)
  const countryCodeListId = useId()
  const logoInputRef = useRef(null)
  const portalInputRef = useRef(null)

  const canEdit = useMemo(() => {
    if (!membership) return false
    return ['owner', 'admin'].includes(membership.role)
  }, [membership])

  useEffect(() => {
    if (account) {
      const nextBranding = normalizeBrandingData(account)
      setBranding(nextBranding)
      const { phoneCountryCode, phoneNumber } = splitPhone(
        nextBranding.support_phone,
        DEFAULT_COUNTRY_CODE
      )
      setSupportPhoneCountryCode(phoneCountryCode)
      setSupportPhoneNumber(phoneNumber)
    }
  }, [account])

  const countryCodeOptions = useMemo(() => {
    const normalizedCode = resolveCountryCodeValue(
      supportPhoneCountryCode,
      DEFAULT_COUNTRY_CODE
    )
    const hasCode = COUNTRY_CODES.some((entry) => entry.dial === normalizedCode)
    if (hasCode) return COUNTRY_CODES
    return [{ iso: 'XX', dial: normalizedCode }, ...COUNTRY_CODES]
  }, [supportPhoneCountryCode])

  const logoSrc = branding.logo_url || account?.logo_url || ''
  const portalImageSrc = branding.portal_image_url || account?.portal_image_url || ''

  const loadMembers = useCallback(async () => {
    if (!account?.id) return
    if (membersFetchInFlight.current) return
    if (lastMembersAccountIdRef.current === account.id && members.length) return
    membersFetchInFlight.current = true
    setMembersLoading(true)
    setMembersError(null)
    const token = getStoredAccessToken()
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const url = apiBase
      ? `${apiBase}/api/v1/account/members?accountId=${account.id}`
      : `/api/v1/account/members?accountId=${account.id}`
    const response = await fetch(url, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setMembersError(body.error || t('common.errors.requestFailed'))
      setMembersLoading(false)
      return
    }

    const body = await response.json()
    setMembers(body.members || [])
    lastMembersAccountIdRef.current = account.id
    setMembersLoading(false)
    membersFetchInFlight.current = false
  }, [account?.id, members.length, t])

  const loadDomains = useCallback(async () => {
    if (!account?.id) return
    if (domainsFetchInFlight.current) return
    if (lastDomainsAccountIdRef.current === account.id && domains.length) return
    domainsFetchInFlight.current = true
    setDomainsLoading(true)
    setDomainsError(null)
    const token = getStoredAccessToken()

    const response = await fetch(`/api/v1/domains?accountId=${account.id}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : ''
      }
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setDomainsError(body.error || t('common.errors.requestFailed'))
      setDomainsLoading(false)
      return
    }

    const body = await response.json()
    setDomains(body.domains || [])
    lastDomainsAccountIdRef.current = account.id
    setDomainsLoading(false)
    domainsFetchInFlight.current = false
  }, [account?.id, domains.length, t])

  useEffect(() => {
    if (canEdit) {
      loadMembers()
    }
  }, [canEdit, loadMembers])

  useEffect(() => {
    if (canEdit) {
      loadDomains()
    }
  }, [canEdit, loadDomains])

  if (!authenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">{t('settings.auth.required')}</p>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="bg-white shadow rounded-2xl p-6 border border-yellow-200">
        <p className="text-lg font-semibold text-yellow-800">{t('settings.auth.noAccess')}</p>
        <p className="text-gray-600 mt-2">{t('settings.auth.hint')}</p>
      </div>
    )
  }

  const handleBrandingSubmit = async (event) => {
    event.preventDefault()
    if (!account?.id) return
    setBrandingSaving(true)
    setBrandingMessage(null)

    const combinedSupportPhone = buildPhone(supportPhoneCountryCode, supportPhoneNumber)

    const token = getStoredAccessToken()
    if (!token) {
      setBrandingMessage({
        type: 'error',
        text: t('common.errors.requestFailed')
      })
      setBrandingSaving(false)
      return
    }

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const brandingUrl = apiBase
      ? `${apiBase}/api/v1/branding?accountId=${account.id}`
      : `/api/v1/branding?accountId=${account.id}`

    try {
      const response = await fetch(brandingUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: branding.account_name,
          logo_url: branding.logo_url,
          portal_image_url: branding.portal_image_url,
          marketplace_region: branding.marketplace_region,
          marketplace_description: branding.marketplace_description,
          marketplace_instagram_url: branding.marketplace_instagram_url,
          marketplace_facebook_url: branding.marketplace_facebook_url,
          marketplace_tiktok_url: branding.marketplace_tiktok_url,
          marketplace_website_url: branding.marketplace_website_url,
          support_email: branding.support_email,
          support_phone: combinedSupportPhone || null,
          brand_primary: branding.brand_primary,
          brand_primary_soft: branding.brand_primary_soft,
          brand_accent: branding.brand_accent,
          brand_accent_soft: branding.brand_accent_soft,
          brand_background: branding.brand_background,
          brand_gradient: branding.brand_gradient
        })
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || t('common.errors.requestFailed'))
      }

      setBrandingMessage({
        type: 'success',
        text: t('settings.branding.success')
      })
      const payloadBranding = normalizeBrandingData(body?.data || {})
      setBranding(payloadBranding)
      const { phoneCountryCode, phoneNumber } = splitPhone(
        payloadBranding.support_phone,
        DEFAULT_COUNTRY_CODE
      )
      setSupportPhoneCountryCode(phoneCountryCode)
      setSupportPhoneNumber(phoneNumber)
      refresh()
    } catch (error) {
      setBrandingMessage({
        type: 'error',
        text: error.message
      })
    } finally {
      setBrandingSaving(false)
    }
  }

  const handleInviteSubmit = async (event) => {
    event.preventDefault()
    if (!account?.id) return
    setInviteLoading(true)
    setInviteMessage(null)

    const token = getStoredAccessToken()

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const url = apiBase ? `${apiBase}/api/v1/account/members` : '/api/v1/account/members'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        accountId: account.id,
        email: inviteForm.email,
        password: inviteForm.password || undefined,
        role: inviteForm.role
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setInviteMessage({
        type: 'error',
        text: body.error || t('common.errors.requestFailed')
      })
      setInviteLoading(false)
      return
    }

    setInviteMessage({
      type: 'success',
      text: t('settings.members.inviteSuccess')
    })
    setInviteForm({ email: '', password: '', role: 'member' })
    setInviteLoading(false)
    loadMembers()
  }

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !account?.id) return
    setLogoUploading(true)
    setBrandingMessage(null)

    let compressedBlob
    try {
      compressedBlob = await compressImage(file, { maxSize: 640 })
    } catch (compressionError) {
      setBrandingMessage({ type: 'error', text: compressionError.message })
      setLogoUploading(false)
      return
    }

    const token = getStoredAccessToken()
    if (!token) {
      setBrandingMessage({ type: 'error', text: t('common.errors.requestFailed') })
      setLogoUploading(false)
      return
    }

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const url = apiBase
      ? `${apiBase}/api/v1/branding/logo?accountId=${account.id}`
      : `/api/v1/branding/logo?accountId=${account.id}`

    const formData = new FormData()
    formData.append('file', compressedBlob, 'logo.jpg')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || t('common.errors.requestFailed'))
      }
      setBranding((prev) => ({ ...prev, logo_url: body.url }))
      setBrandingMessage({ type: 'success', text: t('settings.branding.logoUploaded') })
    } catch (err) {
      setBrandingMessage({ type: 'error', text: err.message })
    } finally {
      setLogoUploading(false)
    }
  }

  const handlePortalImageUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !account?.id) return
    setPortalImageUploading(true)
    setBrandingMessage(null)

    let compressedBlob
    try {
      compressedBlob = await compressImage(file, { maxSize: 1600 })
    } catch (compressionError) {
      setBrandingMessage({ type: 'error', text: compressionError.message })
      setPortalImageUploading(false)
      return
    }

    const token = getStoredAccessToken()
    if (!token) {
      setBrandingMessage({ type: 'error', text: t('common.errors.requestFailed') })
      setPortalImageUploading(false)
      return
    }

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const url = apiBase
      ? `${apiBase}/api/v1/branding/portal-image?accountId=${account.id}`
      : `/api/v1/branding/portal-image?accountId=${account.id}`

    const formData = new FormData()
    formData.append('file', compressedBlob, 'portal-image.jpg')

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || t('common.errors.requestFailed'))
      }
      setBranding((prev) => ({ ...prev, portal_image_url: body.url }))
      setBrandingMessage({ type: 'success', text: t('settings.branding.portalImageUploaded') })
    } catch (err) {
      setBrandingMessage({ type: 'error', text: err.message })
    } finally {
      setPortalImageUploading(false)
    }
  }

  const handleDomainSubmit = async (event) => {
    event.preventDefault()
    if (!account?.id) return
    setDomainSubmitting(true)
    setDomainMessage(null)

    const domainValue = domainForm.domain.trim().toLowerCase()
    if (!domainValue) {
      setDomainMessage({ type: 'error', text: t('settings.domains.errors.required') })
      setDomainSubmitting(false)
      return
    }

    const token = getStoredAccessToken()

    const response = await fetch('/api/v1/domains', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        accountId: account.id,
        domain: domainValue,
        slug: account.slug,
        dnsRecordType: domainForm.dnsRecordType
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setDomainMessage({
        type: 'error',
        text: body.error || t('settings.domains.errors.create')
      })
      setDomainSubmitting(false)
      return
    }

    setDomainMessage({
      type: 'success',
      text: t('settings.domains.messages.created')
    })
    setDomainForm((prev) => ({ ...prev, domain: '' }))
    setDomainSubmitting(false)
    loadDomains()
  }

  const handleDeleteDomain = async (domainId) => {
    if (!account?.id || !domainId) return
    const confirmed = window.confirm(t('settings.domains.confirmations.delete'))
    if (!confirmed) return

    setDomainMessage(null)
    const token = getStoredAccessToken()

    const response = await fetch('/api/v1/domains', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        accountId: account.id,
        domainId
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setDomainMessage({
        type: 'error',
        text: body.error || t('settings.domains.errors.delete')
      })
      return
    }

    setDomainMessage({
      type: 'success',
      text: t('settings.domains.messages.deleted')
    })
    loadDomains()
  }

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200'
      case 'error':
        return 'bg-rose-100 text-rose-700 border border-rose-200'
      case 'disabled':
        return 'bg-gray-100 text-gray-600 border border-gray-200'
      default:
        return 'bg-amber-100 text-amber-700 border border-amber-200'
    }
  }

  const handleVerifyDomain = async (domainId) => {
    if (!account?.id || !domainId) return
    setVerifyingDomainId(domainId)
    setDomainMessage(null)

    const token = getStoredAccessToken()

    const response = await fetch('/api/v1/domains/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      body: JSON.stringify({
        accountId: account.id,
        domainId
      })
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setDomainMessage({
        type: 'error',
        text: body.error || t('settings.domains.errors.verify')
      })
      setVerifyingDomainId(null)
      return
    }

    const matched = body?.verification?.matched
    setDomainMessage({
      type: matched ? 'success' : 'error',
      text: matched
        ? t('settings.domains.messages.verified')
        : body?.verification?.reason || t('settings.domains.messages.verificationMissing')
    })
    setVerifyingDomainId(null)
    loadDomains()
  }

  const cardClass =
    'rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur'
  const subCardClass = 'rounded-2xl border border-slate-200/70 bg-white/95 p-5 shadow-sm'
  const labelClass = 'text-sm font-semibold text-slate-700'
  const inputClass =
    'w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30'
  const selectClass = `${inputClass} appearance-none`
  const textAreaClass = `${inputClass} min-h-[120px] resize-y`
  const helperClass = 'text-xs text-slate-500'
  const sectionTitleClass = 'text-lg font-semibold text-slate-900'
  const sectionDescriptionClass = 'text-sm text-slate-500'
  const metaCardClass =
    'flex min-w-[160px] flex-col rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-2 text-slate-500 shadow-sm'
  const metaLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400'
  const metaValueClass = 'mt-1 text-sm font-semibold text-slate-700'
  const phoneGroupClass =
    'flex items-center rounded-2xl border border-slate-200 bg-white/90 shadow-sm focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/30'
  const phoneFieldClass =
    'bg-transparent px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400'
  const imageWrapperClass =
    'group relative overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50/80'
  const imageOverlayClass =
    'absolute inset-0 flex items-center justify-center bg-slate-900/60 opacity-100 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
  const imageOverlayButtonClass =
    'inline-flex items-center rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-slate-900 shadow'

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-36 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400 shadow-sm">
              {t('settings.page.badge')}
            </span>
            <h1 className="heading-font text-3xl text-slate-900 sm:text-4xl">
              {t('settings.page.title')}
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">{t('settings.page.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className={metaCardClass}>
              <span className={metaLabelClass}>{t('settings.page.accountLabel')}</span>
              <span className={metaValueClass}>
                {branding.account_name || account?.name || account?.slug || '—'}
              </span>
            </div>
            <div className={metaCardClass}>
              <span className={metaLabelClass}>{t('settings.page.slugLabel')}</span>
              <span className={metaValueClass}>{account?.slug || '—'}</span>
            </div>
            <div className={metaCardClass}>
              <span className={metaLabelClass}>{t('settings.page.roleLabel')}</span>
              <span className={metaValueClass}>
                {membership?.role ? t(`settings.members.roles.${membership.role}`) : '—'}
              </span>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-8">
            <section className={cardClass}>
              <div className="flex flex-col gap-2">
                <h2 className="heading-font text-2xl text-slate-900">
                  {t('settings.branding.title')}
                </h2>
                <p className="text-sm text-slate-600">{t('settings.branding.description')}</p>
              </div>

              <form onSubmit={handleBrandingSubmit} className="mt-6 space-y-6">
                <div className={subCardClass}>
                  <div className="flex flex-col gap-1">
                    <h3 className={sectionTitleClass}>
                      {t('settings.branding.sections.identity')}
                    </h3>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.accountName')}
                      </span>
                      <input
                        type="text"
                        value={branding.account_name}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, account_name: e.target.value }))
                        }
                        className={inputClass}
                        placeholder={t('settings.branding.fields.accountNamePlaceholder')}
                      />
                    </label>

                    <div className="flex flex-col gap-2">
                      <span className={labelClass}>{t('settings.branding.fields.logo')}</span>
                      <div className="flex items-center gap-4">
                        <div className={`${imageWrapperClass} h-20 w-20`}>
                          {logoSrc ? (
                            <img
                              src={logoSrc}
                              alt={t('settings.branding.fields.logo')}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {t('settings.branding.fields.logo')}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading}
                            className={`${imageOverlayClass} ${logoUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            aria-label={t('settings.branding.actions.editImage')}
                          >
                            <span className={imageOverlayButtonClass}>
                              {t('settings.branding.actions.editImage')}
                            </span>
                          </button>
                        </div>
                        <div className="flex-1">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={logoUploading}
                            className="sr-only"
                          />
                          {logoUploading && (
                            <span className={helperClass}>
                              {t('settings.branding.logoUploading')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:col-span-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.portalImage')}
                      </span>
                      <div className={`${imageWrapperClass} h-40 sm:h-48`}>
                        {portalImageSrc ? (
                          <img
                            src={portalImageSrc}
                            alt={t('settings.branding.fields.portalImage')}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            {t('settings.branding.fields.portalImage')}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => portalInputRef.current?.click()}
                          disabled={portalImageUploading}
                          className={`${imageOverlayClass} ${portalImageUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          aria-label={t('settings.branding.actions.editImage')}
                        >
                          <span className={imageOverlayButtonClass}>
                            {t('settings.branding.actions.editImage')}
                          </span>
                        </button>
                      </div>
                      <input
                        ref={portalInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePortalImageUpload}
                        disabled={portalImageUploading}
                        className="sr-only"
                      />
                      {portalImageUploading && (
                        <span className={helperClass}>
                          {t('settings.branding.portalImageUploading')}
                        </span>
                      )}
                      <span className={helperClass}>
                        {t('settings.branding.fields.portalImageHelper')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={subCardClass}>
                  <div className="flex flex-col gap-1">
                    <h3 className={sectionTitleClass}>
                      {t('settings.branding.sections.contact')}
                    </h3>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.supportEmail')}
                      </span>
                      <input
                        type="email"
                        value={branding.support_email}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, support_email: e.target.value }))
                        }
                        className={inputClass}
                        placeholder={t('settings.branding.fields.supportEmailPlaceholder')}
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.supportPhone')}
                      </span>
                      <div className={phoneGroupClass}>
                        <input
                          type="text"
                          value={supportPhoneCountryCode}
                          onChange={(e) => setSupportPhoneCountryCode(e.target.value)}
                          onBlur={() =>
                            setSupportPhoneCountryCode(
                              resolveCountryCodeValue(
                                supportPhoneCountryCode,
                                DEFAULT_COUNTRY_CODE
                              )
                            )
                          }
                          list={countryCodeListId}
                          className={`${phoneFieldClass} w-28`}
                          placeholder={t('settings.branding.fields.supportPhoneCodePlaceholder')}
                        />
                        <datalist id={countryCodeListId}>
                          {countryCodeOptions.map((option) => (
                            <option
                              key={`${option.iso}-${option.dial}`}
                              value={
                                option.iso === 'XX' ? option.dial : `${option.iso} ${option.dial}`
                              }
                            />
                          ))}
                        </datalist>
                        <div className="h-6 w-px bg-slate-200" />
                        <input
                          type="tel"
                          value={supportPhoneNumber}
                          onChange={(e) => setSupportPhoneNumber(e.target.value)}
                          className={`${phoneFieldClass} flex-1`}
                          placeholder={t('settings.branding.fields.supportPhoneNumberPlaceholder')}
                        />
                      </div>
                      <span className={helperClass}>
                        {t('settings.branding.fields.supportPhoneHelper')}
                      </span>
                    </label>
                  </div>
                </div>

                <div className={subCardClass}>
                  <div className="flex flex-col gap-1">
                    <h3 className={sectionTitleClass}>{t('settings.marketplace.title')}</h3>
                    <p className={sectionDescriptionClass}>
                      {t('settings.marketplace.description')}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2 md:col-span-2">
                      <span className={labelClass}>
                        {t('settings.marketplace.fields.region')}
                      </span>
                      <input
                        type="text"
                        value={branding.marketplace_region}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_region: e.target.value
                          }))
                        }
                        className={inputClass}
                        placeholder={t('settings.marketplace.fields.regionPlaceholder')}
                      />
                    </label>

                    <label className="flex flex-col gap-2 md:col-span-2">
                      <span className={labelClass}>
                        {t('settings.marketplace.fields.description')}
                      </span>
                      <textarea
                        value={branding.marketplace_description}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_description: e.target.value
                          }))
                        }
                        rows={4}
                        className={textAreaClass}
                        placeholder={t('settings.marketplace.fields.descriptionPlaceholder')}
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.marketplace.fields.instagram')}
                      </span>
                      <input
                        type="url"
                        value={branding.marketplace_instagram_url}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_instagram_url: e.target.value
                          }))
                        }
                        className={inputClass}
                        placeholder={t('settings.marketplace.fields.urlPlaceholder')}
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.marketplace.fields.facebook')}
                      </span>
                      <input
                        type="url"
                        value={branding.marketplace_facebook_url}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_facebook_url: e.target.value
                          }))
                        }
                        className={inputClass}
                        placeholder={t('settings.marketplace.fields.urlPlaceholder')}
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>{t('settings.marketplace.fields.tiktok')}</span>
                      <input
                        type="url"
                        value={branding.marketplace_tiktok_url}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_tiktok_url: e.target.value
                          }))
                        }
                        className={inputClass}
                        placeholder={t('settings.marketplace.fields.urlPlaceholder')}
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.marketplace.fields.website')}
                      </span>
                      <input
                        type="url"
                        value={branding.marketplace_website_url}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            marketplace_website_url: e.target.value
                          }))
                        }
                        className={inputClass}
                        placeholder={t('settings.marketplace.fields.urlPlaceholder')}
                      />
                    </label>
                  </div>
                </div>

                <div className={subCardClass}>
                  <div className="flex flex-col gap-1">
                    <h3 className={sectionTitleClass}>
                      {t('settings.branding.sections.theme')}
                    </h3>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>{t('settings.branding.fields.primary')}</span>
                      <input
                        type="color"
                        value={branding.brand_primary || '#4fafa9'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, brand_primary: e.target.value }))
                        }
                        className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.primarySoft')}
                      </span>
                      <input
                        type="color"
                        value={branding.brand_primary_soft || '#e7f8f7'}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            brand_primary_soft: e.target.value
                          }))
                        }
                        className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>{t('settings.branding.fields.accent')}</span>
                      <input
                        type="color"
                        value={branding.brand_accent || '#f4d58d'}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, brand_accent: e.target.value }))
                        }
                        className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.accentSoft')}
                      </span>
                      <input
                        type="color"
                        value={branding.brand_accent_soft || '#fdf6de'}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            brand_accent_soft: e.target.value
                          }))
                        }
                        className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.background')}
                      </span>
                      <input
                        type="color"
                        value={branding.brand_background || '#fdfcf9'}
                        onChange={(e) =>
                          setBranding((prev) => ({
                            ...prev,
                            brand_background: e.target.value
                          }))
                        }
                        className="h-12 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
                      />
                    </label>

                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className={labelClass}>
                        {t('settings.branding.fields.gradient')}
                      </span>
                      <input
                        type="text"
                        value={branding.brand_gradient}
                        onChange={(e) =>
                          setBranding((prev) => ({ ...prev, brand_gradient: e.target.value }))
                        }
                        className={inputClass}
                        placeholder="linear-gradient(...)"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={brandingSaving}
                    className="btn-brand px-6 py-3 shadow-brand-glow disabled:opacity-60"
                  >
                    {brandingSaving ? t('settings.branding.saving') : t('settings.branding.save')}
                  </button>
                  {brandingMessage && (
                    <div
                      className={`w-full rounded-2xl border px-4 py-3 text-sm sm:w-auto ${brandingMessage.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-600'
                        }`}
                    >
                      {brandingMessage.text}
                    </div>
                  )}
                </div>
              </form>
            </section>
          </div>

          <div className="space-y-8">
            <section className={cardClass}>
              <div className="flex flex-col gap-2">
                <h2 className="heading-font text-2xl text-slate-900">
                  {t('settings.members.title')}
                </h2>
                <p className="text-sm text-slate-600">{t('settings.members.description')}</p>
              </div>

              <form
                onSubmit={handleInviteSubmit}
                className={`${subCardClass} mt-6 grid gap-4 md:grid-cols-3`}
              >
                <label className="flex flex-col gap-2 md:col-span-1">
                  <span className={labelClass}>{t('settings.members.fields.email')}</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                    className={inputClass}
                    placeholder="teammate@example.com"
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-1">
                  <span className={labelClass}>{t('settings.members.fields.password')}</span>
                  <input
                    type="text"
                    value={inviteForm.password}
                    onChange={(e) =>
                      setInviteForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className={inputClass}
                    placeholder={t('settings.members.fields.passwordPlaceholder')}
                  />
                </label>

                <label className="flex flex-col gap-2 md:col-span-1">
                  <span className={labelClass}>{t('settings.members.fields.role')}</span>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
                    className={selectClass}
                  >
                    {ROLE_OPTIONS.map(({ value, labelKey }) => (
                      <option key={value} value={value}>
                        {t(labelKey)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="md:col-span-3 flex flex-wrap gap-3 items-center">
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="btn-brand px-6 py-3 shadow-brand-glow disabled:opacity-60"
                  >
                    {inviteLoading ? t('settings.members.inviting') : t('settings.members.invite')}
                  </button>
                  {inviteMessage && (
                    <div
                      className={`w-full rounded-2xl border px-4 py-3 text-sm sm:w-auto ${inviteMessage.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-600'
                        }`}
                    >
                      {inviteMessage.text}
                    </div>
                  )}
                </div>
              </form>

              <div className="mt-6 space-y-3">
                {membersLoading && (
                  <p className="text-sm text-slate-500">{t('settings.members.loading')}</p>
                )}
                {membersError && <p className="text-sm text-rose-600">{membersError}</p>}
                {!membersLoading && members.length === 0 && (
                  <p className="text-sm text-slate-600">{t('settings.members.empty')}</p>
                )}
                {members.map((member) => {
                  const statusClasses =
                    member.status === 'accepted'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-amber-200 bg-amber-100 text-amber-700'

                  return (
                    <div
                      key={member.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {member.email || member.user_id}
                          </p>
                          <p className="text-xs text-slate-500">
                            {t(`settings.members.roles.${member.role}`)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses}`}
                        >
                          {t(`settings.members.status.${member.status}`)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className={cardClass}>
              <div className="flex flex-col gap-2">
                <h2 className="heading-font text-2xl text-slate-900">
                  {t('settings.domains.title')}
                </h2>
                <p className="text-sm text-slate-600">
                  {t('settings.domains.description', {
                    example: 'portal.teunome.com',
                    slug: account?.slug || ''
                  })}
                </p>
              </div>

              <form
                onSubmit={handleDomainSubmit}
                className={`${subCardClass} mt-6 grid gap-4 md:grid-cols-3`}
              >
                <label className="flex flex-col gap-2 md:col-span-2">
                  <span className={labelClass}>{t('settings.domains.fields.domain')}</span>
                  <input
                    type="text"
                    value={domainForm.domain}
                    onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))}
                    placeholder={t('settings.domains.fields.domainPlaceholder')}
                    className={inputClass}
                    required
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className={labelClass}>{t('settings.domains.fields.recordType')}</span>
                  <select
                    value={domainForm.dnsRecordType}
                    onChange={(e) =>
                      setDomainForm((prev) => ({ ...prev, dnsRecordType: e.target.value }))
                    }
                    className={selectClass}
                  >
                    <option value="txt">
                      {t('settings.domains.fields.recordTypeOptions.txt')}
                    </option>
                    <option value="cname">
                      {t('settings.domains.fields.recordTypeOptions.cname')}
                    </option>
                  </select>
                </label>

                <div className="md:col-span-3 flex flex-wrap gap-3 items-center">
                  <button
                    type="submit"
                    disabled={domainSubmitting}
                    className="btn-brand px-6 py-3 shadow-brand-glow disabled:opacity-60"
                  >
                    {domainSubmitting
                      ? t('settings.domains.buttons.adding')
                      : t('settings.domains.buttons.add')}
                  </button>
                  {domainMessage && (
                    <div
                      className={`w-full rounded-2xl border px-4 py-3 text-sm sm:w-auto ${domainMessage.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-600'
                        }`}
                    >
                      {domainMessage.text}
                    </div>
                  )}
                </div>
              </form>

              <div className="mt-6 space-y-4">
                {domainsLoading && (
                  <p className="text-sm text-slate-500">{t('settings.domains.loading')}</p>
                )}
                {domainsError && <p className="text-sm text-rose-600">{domainsError}</p>}
                {!domainsLoading && domains.length === 0 && (
                  <p className="text-sm text-slate-600">{t('settings.domains.empty')}</p>
                )}

                {domains.map((domain) => {
                  const txtHost = `_verify.${domain.domain}`
                  const txtValue = `verify=${domain.verification_token}`
                  const statusKey = domain.status || 'pending'
                  const verifiedText =
                    domain.status === 'active' && domain.verified_at
                      ? t('settings.domains.labels.verifiedAt', {
                        date: new Intl.DateTimeFormat(resolvedLocale, {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        }).format(new Date(domain.verified_at))
                      })
                      : null

                  return (
                    <div
                      key={domain.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{domain.domain}</p>
                          <p className="text-xs text-slate-500">
                            {t('settings.domains.slugLabel', { slug: domain.slug })}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(
                              domain.status
                            )}`}
                          >
                            {t(`settings.domains.status.${statusKey}`)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleVerifyDomain(domain.id)}
                            disabled={domain.status === 'active' || verifyingDomainId === domain.id}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${domain.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed'
                              }`}
                          >
                            {domain.status === 'active'
                              ? t('settings.domains.buttons.verified')
                              : verifyingDomainId === domain.id
                                ? t('settings.domains.buttons.verifying')
                                : t('settings.domains.buttons.verify')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDomain(domain.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-500"
                          >
                            {t('settings.domains.buttons.remove')}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-600">
                        <p>{t('settings.domains.steps.cname')}</p>
                        <p>{t('settings.domains.steps.txt')}</p>
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 font-mono text-xs text-slate-800">
                          <p>
                            {t('settings.domains.labels.host')}: {txtHost}
                          </p>
                          <p>
                            {t('settings.domains.labels.value')}: {txtValue}
                          </p>
                        </div>
                        {domain.last_error && (
                          <p className="text-xs text-rose-600">
                            {t('settings.domains.labels.error', { message: domain.last_error })}
                          </p>
                        )}
                        {verifiedText && <p className="text-xs text-emerald-600">{verifiedText}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 text-sm text-amber-900">
                <p className="mb-2 font-semibold">{t('settings.domains.instructions.title')}</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>{t('settings.domains.instructions.step1')}</li>
                  <li>{t('settings.domains.instructions.step2')}</li>
                  <li>{t('settings.domains.instructions.step3')}</li>
                </ol>
                <p className="mt-2 text-xs text-amber-800">
                  {t('settings.domains.instructions.note')}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
