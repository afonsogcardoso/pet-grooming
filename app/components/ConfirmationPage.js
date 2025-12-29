'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'
import { formatCustomerName } from '@/lib/customerName'
import { formatDate, formatTime } from '@/utils/dateUtils'
import ConfirmationPetPhoto from './ConfirmationPetPhoto'
import { compressImage } from '@/utils/image'

const InfoRow = ({ label, value, accent }) => {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
        {label}
      </p>
      <p className={`text-base font-semibold text-slate-900 ${accent ? 'text-brand-primary' : ''}`}>
        {value}
      </p>
    </div>
  )
}

export default function ConfirmationPage({ appointment }) {
  const { t, resolvedLocale } = useTranslation()
  const [isMounted, setIsMounted] = useState(false)
  const [confirmationUrl, setConfirmationUrl] = useState('')
  const [petPhotoUrl, setPetPhotoUrl] = useState(appointment?.pets?.photo_url || '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setConfirmationUrl(window.location.href)
    }
  }, [])

  const hasAppointment = Boolean(appointment)
  const customer = formatCustomerName(appointment?.customers)
  const pet = appointment?.pets?.name || ''
  const petPhoto = petPhotoUrl || appointment?.pets?.photo_url || ''
  const service = appointment?.services?.name || ''
  const address = appointment?.customers?.address || ''
  const notes = appointment?.notes || ''
  const paymentStatus = appointment?.payment_status || 'unpaid'
  const duration = appointment?.duration
  const date = appointment?.appointment_date
  const time = appointment?.appointment_time

  const formattedDate = useMemo(() => formatDate(date, resolvedLocale), [date, resolvedLocale])
  const formattedTime = useMemo(() => formatTime(time, resolvedLocale), [time, resolvedLocale])

  const pageTitle = customer
    ? t('confirmationPage.title', { customer })
    : t('confirmationPage.titleNoName')

  const paymentLabel =
    paymentStatus === 'paid'
      ? t('confirmationPage.payment.paid')
      : t('confirmationPage.payment.unpaid')

  const dateValue = (isMounted ? formattedDate : date) || t('confirmationPage.missing.generic')
  const timeValue = (isMounted ? formattedTime : time) || t('confirmationPage.missing.generic')
  const serviceValue = service || t('confirmationPage.missing.generic')
  const petValue = pet || t('confirmationPage.missing.generic')
  const durationValue = duration
    ? t('confirmationPage.durationMinutes', { duration })
    : t('confirmationPage.missing.generic')
  const addressValue = address || t('confirmationPage.missing.generic')

  useEffect(() => {
    if (!hasAppointment || !appointment?.id || !appointment?.public_token) return
    // Fire-and-forget beacon to mark open
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/v1/appointments/confirm-open',
        new Blob([JSON.stringify({ id: appointment.id, token: appointment.public_token })], {
          type: 'application/json'
        })
      )
    } else {
      fetch('/api/v1/appointments/confirm-open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointment.id, token: appointment.public_token })
      }).catch(() => {})
    }
  }, [appointment, hasAppointment])

  const handlePetPhotoUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !appointment?.id || !appointment?.public_token) return
    setUploadError('')
    setUploading(true)
    try {
      const compressed = await compressImage(file, { maxSize: 800 })
      const form = new FormData()
      form.append('id', appointment.id)
      form.append('token', appointment.public_token)
      form.append('file', compressed)

      const response = await fetch('/api/v1/appointments/pet-photo', {
        method: 'POST',
        body: form
      })
      const result = await response.json()
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || 'upload_failed')
      }
      if (result.url) {
        setPetPhotoUrl(result.url)
      }
    } catch (error) {
      setUploadError(t('confirmationPage.actions.photoError'))
      console.error('pet photo upload failed', error)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const handleAddToCalendar = () => {
    if (!appointment?.id || !appointment?.public_token) return
    const params = new URLSearchParams({
      id: appointment.id,
      token: appointment.public_token
    })
    window.location.href = `/api/v1/appointments/ics?${params.toString()}`
  }

  if (!hasAppointment) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-brand-primary-soft via-white to-brand-accent-soft px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white/80 p-6 text-center shadow-xl backdrop-blur">
          <h1 className="text-2xl font-bold text-slate-800">{t('confirmationPage.titleNoName')}</h1>
          <p className="mt-2 text-slate-600">{t('confirmationPage.notFound')}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-primary-soft via-white to-brand-accent-soft px-4 py-10 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-primary">
            {t('confirmationPage.header')}
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{pageTitle}</h1>
          <p className="mt-2 text-base text-slate-600">{t('confirmationPage.subtitle')}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur">
          <div className="mb-4">
            <ConfirmationPetPhoto
              photoUrl={petPhoto}
              petName={pet}
              placeholderEmpty={t('confirmationPage.actions.photoEmpty')}
              removeLabel={t('confirmationPage.actions.photoPlaceholder')}
              onUpload={handlePetPhotoUpload}
              uploading={uploading}
              error={uploadError}
              onRemove={() => {
                setPetPhotoUrl('')
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow
              label={t('confirmationPage.labels.date')}
              value={dateValue}
              accent
            />
            <InfoRow
              label={t('confirmationPage.labels.time')}
              value={timeValue}
              accent
            />
            <InfoRow
              label={t('confirmationPage.labels.service')}
              value={serviceValue}
            />
            <InfoRow
              label={t('confirmationPage.labels.duration')}
              value={durationValue}
            />
            <InfoRow
              label={t('confirmationPage.labels.pet')}
              value={petValue}
            />
            <InfoRow
              label={t('confirmationPage.labels.payment')}
              value={paymentLabel}
            />
            <InfoRow
              label={t('confirmationPage.labels.address')}
              value={addressValue}
            />
          </div>

          {notes && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-inner">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em]">
                {t('confirmationPage.labels.notes')}
              </p>
              <p className="font-medium leading-relaxed">{notes}</p>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-800 mb-2">
              {t('confirmationPage.actions.addToCalendar')}
            </p>
            <p className="text-xs text-slate-600 mb-3">
              {t('confirmationPage.actions.addToCalendarHelper')}
            </p>
            <button
              type="button"
              onClick={handleAddToCalendar}
              className="w-full rounded-xl bg-brand-primary text-white font-semibold py-3 hover:bg-brand-primary-dark transition"
            >
              {t('confirmationPage.actions.addToCalendarButton')}
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <p>✅ {t('confirmationPage.footer.confirmed')}</p>
            <p>🔄 {t('confirmationPage.footer.update')}</p>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500">
          <div className="mt-3 inline-block text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {t('confirmationPage.footer.cancellation.title')}
            </p>
            <ul className="mt-1 space-y-1 text-[11px] leading-snug text-slate-600">
              <li>{t('confirmationPage.footer.cancellation.line1')}</li>
              <li>{t('confirmationPage.footer.cancellation.line2')}</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
