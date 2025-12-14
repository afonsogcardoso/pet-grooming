'use client'

// ============================================
// FILE: app/settings/page.js
// Account branding + member management
// ============================================

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useAccount } from '@/components/AccountProvider'
import { useTranslation } from '@/components/TranslationProvider'
import { compressImage } from '@/utils/image'
import { getStoredAccessToken } from '@/lib/authTokens'

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
  support_email: data.support_email ?? '',
  support_phone: data.support_phone ?? '',
  brand_primary: data.brand_primary ?? '',
  brand_primary_soft: data.brand_primary_soft ?? '',
  brand_accent: data.brand_accent ?? '',
  brand_accent_soft: data.brand_accent_soft ?? '',
  brand_background: data.brand_background ?? '',
  brand_gradient: data.brand_gradient ?? ''
})


export default function SettingsPage() {
  const { account, membership, authenticated, refresh } = useAccount()
  const { t, resolvedLocale } = useTranslation()
  const [branding, setBranding] = useState({
    account_name: '',
    logo_url: '',
    portal_image_url: '',
    support_email: '',
    support_phone: '',
    brand_primary: '',
    brand_primary_soft: '',
    brand_accent: '',
    brand_accent_soft: '',
    brand_background: '',
    brand_gradient: ''
  })
  const [brandingSaving, setBrandingSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
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

  const canEdit = useMemo(() => {
    if (!membership) return false
    return ['owner', 'admin'].includes(membership.role)
  }, [membership])

  useEffect(() => {
    if (account) {
      setBranding(normalizeBrandingData(account))
    }
  }, [account])

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
          support_email: branding.support_email,
          support_phone: branding.support_phone,
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
        return 'bg-emerald-100 text-emerald-700'
      case 'error':
        return 'bg-rose-100 text-rose-700'
      case 'disabled':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-amber-100 text-amber-700'
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

  return (
    <div className="space-y-8">
      <section className="bg-white shadow rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.branding.title')}</h2>
          <p className="text-gray-600">{t('settings.branding.description')}</p>
        </div>

        <form onSubmit={handleBrandingSubmit} className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.accountName')}
            <input
              type="text"
              value={branding.account_name}
              onChange={(e) => setBranding((prev) => ({ ...prev, account_name: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder={t('settings.branding.fields.accountNamePlaceholder')}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.logo')}
            <input
              type="url"
              value={branding.logo_url}
              onChange={(e) => setBranding((prev) => ({ ...prev, logo_url: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder="https://..."
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={logoUploading}
              className="mt-2 text-sm text-gray-600"
            />
            {logoUploading && (
              <span className="text-xs text-gray-500">{t('settings.branding.logoUploading')}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.portalImage')}
            <input
              type="url"
              value={branding.portal_image_url}
              onChange={(e) => setBranding((prev) => ({ ...prev, portal_image_url: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder="https://cdn.example.com/portal-image.jpg"
            />
            <span className="text-xs text-gray-500">
              {t('settings.branding.fields.portalImageHelper')}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.supportEmail')}
            <input
              type="email"
              value={branding.support_email}
              onChange={(e) => setBranding((prev) => ({ ...prev, support_email: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder={t('settings.branding.fields.supportEmailPlaceholder')}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.supportPhone')}
            <input
              type="tel"
              value={branding.support_phone}
              onChange={(e) => setBranding((prev) => ({ ...prev, support_phone: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder={t('settings.branding.fields.supportPhonePlaceholder')}
            />
            <span className="text-xs text-gray-500">
              {t('settings.branding.fields.supportPhoneHelper')}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.primary')}
            <input
              type="color"
              value={branding.brand_primary || '#4fafa9'}
              onChange={(e) => setBranding((prev) => ({ ...prev, brand_primary: e.target.value }))}
              className="w-full h-12 border-2 border-gray-200 rounded-lg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.primarySoft')}
            <input
              type="color"
              value={branding.brand_primary_soft || '#e7f8f7'}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, brand_primary_soft: e.target.value }))
              }
              className="w-full h-12 border-2 border-gray-200 rounded-lg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.accent')}
            <input
              type="color"
              value={branding.brand_accent || '#f4d58d'}
              onChange={(e) => setBranding((prev) => ({ ...prev, brand_accent: e.target.value }))}
              className="w-full h-12 border-2 border-gray-200 rounded-lg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.accentSoft')}
            <input
              type="color"
              value={branding.brand_accent_soft || '#fdf6de'}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, brand_accent_soft: e.target.value }))
              }
              className="w-full h-12 border-2 border-gray-200 rounded-lg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.branding.fields.background')}
            <input
              type="color"
              value={branding.brand_background || '#fdfcf9'}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, brand_background: e.target.value }))
              }
              className="w-full h-12 border-2 border-gray-200 rounded-lg"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-2">
            {t('settings.branding.fields.gradient')}
            <input
              type="text"
              value={branding.brand_gradient}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, brand_gradient: e.target.value }))
              }
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder="linear-gradient(...)"
            />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-3 items-center">
            <button
              type="submit"
              disabled={brandingSaving}
              className="btn-brand px-6 py-3 shadow-brand-glow disabled:opacity-60"
            >
              {brandingSaving ? t('settings.branding.saving') : t('settings.branding.save')}
            </button>
            {brandingMessage && (
              <span
                className={`text-sm ${brandingMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
              >
                {brandingMessage.text}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white shadow rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.members.title')}</h2>
          <p className="text-gray-600">{t('settings.members.description')}</p>
        </div>

        <form onSubmit={handleInviteSubmit} className="grid gap-4 md:grid-cols-3 mb-8">
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-1">
            {t('settings.members.fields.email')}
            <input
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
              required
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder="teammate@example.com"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-1">
            {t('settings.members.fields.password')}
            <input
              type="text"
              value={inviteForm.password}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              placeholder={t('settings.members.fields.passwordPlaceholder')}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-1">
            {t('settings.members.fields.role')}
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
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
              <span
                className={`text-sm ${inviteMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
              >
                {inviteMessage.text}
              </span>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {membersLoading && <p className="text-gray-500">{t('settings.members.loading')}</p>}
          {membersError && <p className="text-rose-600 text-sm">{membersError}</p>}
          {!membersLoading && members.length === 0 && (
            <p className="text-gray-600">{t('settings.members.empty')}</p>
          )}
          {members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-gray-200 rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-semibold text-gray-900">{member.email || member.user_id}</p>
                <p className="text-sm text-gray-600">{t(`settings.members.roles.${member.role}`)}</p>
              </div>
              <span
                className={`mt-2 sm:mt-0 px-3 py-1 rounded-full text-xs font-semibold ${member.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-yellow-100 text-yellow-700'
                  }`}
              >
                {t(`settings.members.status.${member.status}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white shadow rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col gap-2 mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.domains.title')}</h2>
          <p className="text-gray-600">
            {t('settings.domains.description', {
              example: 'portal.teunome.com',
              slug: account?.slug || ''
            })}
          </p>
        </div>

        <form onSubmit={handleDomainSubmit} className="grid gap-4 md:grid-cols-3 mb-6">
          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700 md:col-span-2">
            {t('settings.domains.fields.domain')}
            <input
              type="text"
              value={domainForm.domain}
              onChange={(e) => setDomainForm((prev) => ({ ...prev, domain: e.target.value }))}
              placeholder={t('settings.domains.fields.domainPlaceholder')}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-gray-700">
            {t('settings.domains.fields.recordType')}
            <select
              value={domainForm.dnsRecordType}
              onChange={(e) => setDomainForm((prev) => ({ ...prev, dnsRecordType: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-gray-900"
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
              <span
                className={`text-sm ${domainMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
              >
                {domainMessage.text}
              </span>
            )}
          </div>
        </form>

        <div className="space-y-3">
          {domainsLoading && <p className="text-gray-500">{t('settings.domains.loading')}</p>}
          {domainsError && <p className="text-rose-600 text-sm">{domainsError}</p>}
          {!domainsLoading && domains.length === 0 && (
            <p className="text-gray-600">{t('settings.domains.empty')}</p>
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
                className="border border-gray-200 rounded-2xl p-4 flex flex-col gap-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{domain.domain}</p>
                    <p className="text-sm text-gray-600">
                      {t('settings.domains.slugLabel', { slug: domain.slug })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                        domain.status
                      )}`}
                    >
                      {t(`settings.domains.status.${statusKey}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleVerifyDomain(domain.id)}
                      disabled={domain.status === 'active' || verifyingDomainId === domain.id}
                      className={`px-4 py-2 text-sm font-semibold rounded-full border transition ${domain.status === 'active'
                        ? 'border-emerald-300 text-emerald-600 bg-emerald-50'
                        : 'border-brand-primary text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 disabled:cursor-not-allowed'
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
                      className="text-sm text-rose-600 hover:text-rose-500 font-semibold"
                    >
                      {t('settings.domains.buttons.remove')}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-gray-700">
                  <p>{t('settings.domains.steps.cname')}</p>
                  <p>{t('settings.domains.steps.txt')}</p>
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-3 font-mono text-xs text-gray-800">
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
                  {verifiedText && (
                    <p className="text-xs text-emerald-600">{verifiedText}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold mb-2">{t('settings.domains.instructions.title')}</p>
          <ol className="list-decimal list-inside space-y-1">
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
  )
}
