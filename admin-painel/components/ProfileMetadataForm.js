'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { compressImage } from '@/utils/image'
import { useTranslation } from '@/components/TranslationProvider'
import { getCurrentAccountId } from '@/lib/accountHelpers'
import PhoneInput from '@/components/PhoneInput'

export default function ProfileMetadataForm({
  initialDisplayName = '',
  initialPhone = '',
  initialLocale = 'pt',
  initialAvatarUrl = ''
}) {
  const { t, setLocale: setAppLocale, availableLocales } = useTranslation()
  const [form, setForm] = useState({
    displayName: initialDisplayName,
    phone: initialPhone,
    locale: initialLocale
  })
  const [avatarPreview, setAvatarPreview] = useState(initialAvatarUrl || '')
  const [avatarFile, setAvatarFile] = useState(null)
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const localeOptions = useMemo(
    () =>
      (availableLocales || []).map((code) => ({
        value: code,
        label: t(`profile.form.localeOptions.${code}`)
      })),
    [availableLocales, t]
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus(null)

    try {
      let uploadedAvatarUrl = avatarPreview
      if (avatarFile) {
        const formData = new FormData()
        formData.append('file', avatarFile)
        const accountId = getCurrentAccountId({ required: false })
        const uploadHeaders = accountId ? { 'X-Account-Id': accountId } : undefined
        const uploadResp = await fetch('/api/v1/profile/avatar', { method: 'POST', body: formData, headers: uploadHeaders })
        const uploadBody = await uploadResp.json().catch(() => ({}))
        if (!uploadResp.ok) {
          throw new Error(uploadBody.error || t('profile.form.errors.update'))
        }
        uploadedAvatarUrl = uploadBody.url || ''
      }

      const headers = { 'Content-Type': 'application/json' }
      if (accountId) headers['X-Account-Id'] = accountId
      const response = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ ...form, avatarUrl: uploadedAvatarUrl })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || t('profile.form.errors.update'))
      }
      setStatus({ type: 'success', text: t('profile.form.success') })
      if (form.locale) {
        setAppLocale?.(form.locale)
      }
      if (uploadedAvatarUrl) {
        setAvatarPreview(uploadedAvatarUrl)
        setAvatarFile(null)
      }
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="h-16 w-16 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-500 hover:border-brand-primary focus:outline-none"
          onClick={() => fileInputRef.current?.click()}
          aria-label={t('profile.form.avatarLabel')}
        >
          {avatarPreview ? (
            <Image
              src={avatarPreview}
              alt={t('profile.form.avatarLabel')}
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          ) : (
            '👤'
          )}
        </button>
        <div className="text-sm font-semibold text-slate-600">
          {t('profile.form.avatarLabel')}
          <p className="text-xs font-normal text-slate-500">{t('profile.form.avatarHelper')}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            try {
              const compressedBlob = await compressImage(file, { maxSize: 512, quality: 0.8 })
              const compressedFile = new File([compressedBlob], file.name || 'avatar.jpg', {
                type: compressedBlob.type || 'image/jpeg'
              })
              setAvatarFile(compressedFile)
              const previewUrl = URL.createObjectURL(compressedBlob)
              setAvatarPreview(previewUrl)
            } catch (error) {
              setStatus({ type: 'error', text: t('profile.form.errors.update') })
            }
          }}
        />
      </div>
      <label className="block text-sm font-semibold text-slate-600">
        {t('profile.form.displayNameLabel')}
        <input
          type="text"
          value={form.displayName}
          onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
          placeholder={t('profile.form.displayNamePlaceholder')}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
        />
      </label>
      <PhoneInput
        label={t('profile.form.phoneLabel')}
        value={form.phone}
        onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
        placeholder={t('profile.form.phonePlaceholder')}
      />
      <label className="block text-sm font-semibold text-slate-600">
        {t('profile.form.localeLabel')}
        <select
          value={form.locale}
          onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none bg-white"
        >
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {t('profile.form.localeHelper')}
        </p>
      </label>
      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
        >
          {status.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t('profile.form.saving') : t('profile.form.save')}
      </button>
    </form>
  )
}
