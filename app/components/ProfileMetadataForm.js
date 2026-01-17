'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { compressImage } from '@/utils/image'
import { useTranslation } from '@/components/TranslationProvider'
import { getCurrentAccountId } from '@/lib/accountHelpers'
import PhoneInput from '@/components/PhoneInput'

const DEFAULT_NOTIFICATION_PREFERENCES = {
  push: {
    enabled: false,
    appointments: {
      created: true,
      confirmed: true,
      cancelled: true,
      reminder: true,
      reminder_offsets: [30]
    },
    marketplace: {
      request: true
    },
    payments: {
      updated: true
    },
    marketing: false
  }
}

function normalizeNotificationPreferences(input) {
  const source = input && typeof input === 'object' ? input : {}
  const push = source.push && typeof source.push === 'object' ? source.push : {}
  const appointments =
    push.appointments && typeof push.appointments === 'object' ? push.appointments : {}
  const marketplace =
    push.marketplace && typeof push.marketplace === 'object' ? push.marketplace : {}
  const payments = push.payments && typeof push.payments === 'object' ? push.payments : {}

  return {
    push: {
      enabled: typeof push.enabled === 'boolean' ? push.enabled : DEFAULT_NOTIFICATION_PREFERENCES.push.enabled,
      appointments: {
        created:
          typeof appointments.created === 'boolean'
            ? appointments.created
            : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.created,
        confirmed:
          typeof appointments.confirmed === 'boolean'
            ? appointments.confirmed
            : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.confirmed,
        cancelled:
          typeof appointments.cancelled === 'boolean'
            ? appointments.cancelled
            : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.cancelled,
        reminder:
          typeof appointments.reminder === 'boolean'
            ? appointments.reminder
            : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder,
        reminder_offsets: Array.isArray(appointments.reminder_offsets)
          ? appointments.reminder_offsets
          : DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder_offsets
      },
      marketplace: {
        request:
          typeof marketplace.request === 'boolean'
            ? marketplace.request
            : DEFAULT_NOTIFICATION_PREFERENCES.push.marketplace.request
      },
      payments: {
        updated:
          typeof payments.updated === 'boolean'
            ? payments.updated
            : DEFAULT_NOTIFICATION_PREFERENCES.push.payments.updated
      },
      marketing:
        typeof push.marketing === 'boolean'
          ? push.marketing
          : DEFAULT_NOTIFICATION_PREFERENCES.push.marketing
    }
  }
}

export default function ProfileMetadataForm({
  initialDisplayName = '',
  initialPhone = '',
  initialLocale = 'pt',
  initialAvatarUrl = '',
  initialNotificationPreferences = null
}) {
  const { t, setLocale: setAppLocale, availableLocales } = useTranslation()
  const [form, setForm] = useState({
    displayName: initialDisplayName,
    phone: initialPhone,
    locale: initialLocale
  })
  const [notificationPreferences, setNotificationPreferences] = useState(() =>
    normalizeNotificationPreferences(initialNotificationPreferences)
  )
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
  const pushEnabled = notificationPreferences.push.enabled

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

      const notificationsResponse = await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ preferences: notificationPreferences })
      })
      const notificationsBody = await notificationsResponse.json().catch(() => ({}))
      if (!notificationsResponse.ok) {
        throw new Error(notificationsBody.error || t('profile.form.errors.notifications'))
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
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-600">
          {t('profile.form.notificationsTitle')}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t('profile.form.notificationsHelper')}
        </p>
        <div className="mt-3 space-y-3">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            <span>{t('profile.form.notificationsPush')}</span>
            <input
              type="checkbox"
              checked={notificationPreferences.push.enabled}
              onChange={(event) =>
                setNotificationPreferences((prev) => ({
                  ...prev,
                  push: { ...prev.push, enabled: event.target.checked }
                }))
              }
              className="h-4 w-4 accent-slate-900"
            />
          </label>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('profile.form.notificationsAppointments')}
            </p>
            <div className="mt-2 space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsAppointmentsCreated')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.appointments.created}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        appointments: {
                          ...prev.push.appointments,
                          created: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsAppointmentsConfirmed')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.appointments.confirmed}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        appointments: {
                          ...prev.push.appointments,
                          confirmed: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsAppointmentsCancelled')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.appointments.cancelled}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        appointments: {
                          ...prev.push.appointments,
                          cancelled: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsAppointmentsReminder')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.appointments.reminder}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        appointments: {
                          ...prev.push.appointments,
                          reminder: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('profile.form.notificationsMarketplace')}
            </p>
            <div className="mt-2">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsMarketplaceRequests')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.marketplace.request}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        marketplace: {
                          ...prev.push.marketplace,
                          request: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('profile.form.notificationsPayments')}
            </p>
            <div className="mt-2">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsPaymentsUpdated')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.payments.updated}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        payments: {
                          ...prev.push.payments,
                          updated: event.target.checked
                        }
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('profile.form.notificationsMarketing')}
            </p>
            <div className="mt-2">
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
                <span>{t('profile.form.notificationsMarketing')}</span>
                <input
                  type="checkbox"
                  checked={notificationPreferences.push.marketing}
                  disabled={!pushEnabled}
                  onChange={(event) =>
                    setNotificationPreferences((prev) => ({
                      ...prev,
                      push: {
                        ...prev.push,
                        marketing: event.target.checked
                      }
                    }))
                  }
                  className="h-4 w-4 accent-slate-900 disabled:opacity-40"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
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
