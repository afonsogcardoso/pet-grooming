'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  loadAppointments,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment as deleteAppointmentService,
  markWhatsappSent
} from '@/lib/appointmentService'
import { supabase } from '@/lib/supabase'
import { useTranslation } from '@/components/TranslationProvider'
import { compressImage } from '@/utils/image'
import { formatDate, formatTime, getWeekRangeText } from '@/utils/dateUtils'

const APPOINTMENT_PHOTO_BUCKET = 'appointment-photos'

const LoadingCard = ({ labelKey }) => {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-2xl shadow-md border border-brand-primary/20 p-6 text-center text-gray-500 animate-pulse">
      {t(labelKey)}
    </div>
  )
}

const CalendarView = dynamic(() => import('@/components/CalendarView'), {
  ssr: false,
  loading: () => <LoadingCard labelKey="appointmentsPage.loaders.calendar" />
})

const CalendarViewMobile = dynamic(() => import('@/components/CalendarViewMobile'), {
  ssr: false,
  loading: () => <LoadingCard labelKey="appointmentsPage.loaders.calendar" />
})

const AppointmentList = dynamic(() => import('@/components/AppointmentList'), {
  loading: () => <LoadingCard labelKey="appointmentsPage.loaders.list" />
})

const AppointmentForm = dynamic(() => import('@/components/AppointmentForm'), {
  ssr: false,
  loading: () => <LoadingCard labelKey="appointmentsPage.loaders.form" />
})

export default function CompactAppointmentsPage() {
  const hasLoadedRef = useRef(false)
  const calendarContainerRef = useRef(null)
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState(null)
  const [prefilledData, setPrefilledData] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [sharePreview, setSharePreview] = useState(null)
  const [slotHeight, setSlotHeight] = useState(32)
  const [viewMode, setViewMode] = useState('calendar')
  const [viewSelectorOpen, setViewSelectorOpen] = useState(false)
  const viewSelectorRef = useRef(null)
  const { t, resolvedLocale } = useTranslation()

  const slotsCount = useMemo(() => {
    const start = 9 * 60
    const end = 18 * 60
    const interval = 30
    return Math.floor((end - start) / interval) + 1
  }, [])

  useEffect(() => {
    if (!showForm) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showForm])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    const { data, error } = await loadAppointments()

    if (error) {
      console.error('Error loading appointments:', error)
      alert(t('appointmentsPage.errors.load', { message: error.message }))
    } else {
      setAppointments(data)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    fetchAppointments()
  }, [fetchAppointments])

  const handleCreateAtSlot = (dateStr, time) => {
    setPrefilledData({
      appointment_date: dateStr,
      appointment_time: time
    })
    setEditingAppointment(null)
    setShowForm(true)
  }

  const handleEditAppointment = (appointment) => {
    setEditingAppointment(appointment)
    setShowForm(true)
  }

  const handleCancelEdit = () => {
    setEditingAppointment(null)
    setPrefilledData(null)
    setShowForm(false)
  }

  const handleMarkCompleted = async (appointmentId) => {
    const { error } = await updateAppointmentStatus(appointmentId, 'completed')

    if (error) {
      alert(t('appointmentsPage.errors.updateStatus', { message: error.message }))
    } else {
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status: 'completed' } : apt))
      )
    }
  }

  const handleDeleteAppointment = async (appointmentId) => {
    if (!confirm(t('appointmentsPage.confirmDelete'))) return
    const { error } = await deleteAppointmentService(appointmentId)

    if (error) {
      alert(t('appointmentsPage.errors.delete', { message: error.message }))
    } else {
      setAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId))
    }
  }

  const openWhatsAppForAppointment = (appointment, { forceRedirect = false } = {}) => {
    if (!appointment?.public_token || !appointment?.id) {
      alert(t('appointmentForm.messages.noShareToken'))
      return
    }
    const phoneNumber = appointment.customers?.phone || ''
    const phoneDigits = phoneNumber.replace(/\D/g, '')
    if (!phoneDigits) {
      alert(t('appointmentForm.messages.selectCustomerFirst'))
      return
    }

    const dateText = formatDate(appointment.appointment_date, resolvedLocale)
    const timeText = formatTime(appointment.appointment_time, resolvedLocale)
    const customerName = appointment.customers?.name
    const petName = appointment.pets?.name
    const petBreed = appointment.pets?.breed
    const serviceName = appointment.services?.name
    const address = appointment.customers?.address

    const introMessage = customerName
      ? t('appointmentCard.share.messageWithName', {
          customer: customerName,
          date: dateText,
          time: timeText
        })
      : t('appointmentCard.share.messageNoName', {
          date: dateText,
          time: timeText
        })

    const confirmationUrl = `${window.location.origin}/appointments/confirm?id=${appointment.id}&token=${appointment.public_token}`

    const detailLines = [
      serviceName && t('appointmentCard.share.service', { service: serviceName }),
      petName && t('appointmentCard.share.pet', { pet: petBreed ? `${petName} (${petBreed})` : petName }),
      address && t('appointmentCard.share.address', { address }),
      t('appointmentCard.share.link', { url: confirmationUrl })
    ].filter(Boolean)

    const messageBody = [introMessage, '', ...detailLines].join('\n')

    const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageBody)}`
    setSharePreview({ message: messageBody, waUrl, forceRedirect, id: appointment.id })
  }

  async function handleCreateAppointment(formData, media = {}, options = { sendWhatsapp: false }) {
    const payload = { ...formData }

    try {
      if (media.beforePhotoFile) {
        payload.before_photo_url = await uploadAppointmentPhoto(media.beforePhotoFile, 'before')
      } else if (media.removeBeforePhoto) {
        payload.before_photo_url = null
        if (media.currentBeforePhotoUrl) {
          await deleteAppointmentPhoto(media.currentBeforePhotoUrl)
        }
      }

      if (media.afterPhotoFile) {
        payload.after_photo_url = await uploadAppointmentPhoto(media.afterPhotoFile, 'after')
      } else if (media.removeAfterPhoto) {
        payload.after_photo_url = null
        if (media.currentAfterPhotoUrl) {
          await deleteAppointmentPhoto(media.currentAfterPhotoUrl)
        }
      }
    } catch (photoError) {
      alert(t('appointmentsPage.errors.photoUpload', { message: photoError.message }))
      return
    }

    const { data, error } = await createAppointment(payload)

    if (error) {
      alert(t('appointmentsPage.errors.create', { message: error.message }))
    } else {
      const created = data?.[0] || null

      if (options?.sendWhatsapp && created?.id) {
        const { data: latest } = await loadAppointments()
        if (latest && Array.isArray(latest)) {
          setAppointments(latest)
          const match = latest.find((apt) => apt.id === created.id) || created
          openWhatsAppForAppointment(match, { forceRedirect: true })
        } else {
          openWhatsAppForAppointment(created, { forceRedirect: true })
          await fetchAppointments()
        }
      } else {
        await fetchAppointments()
      }

      setShowForm(false)
    }
  }

  async function handleUpdateAppointment(formData, media = {}, _options = {}) {
    const payload = {
      ...formData
    }
    const appointmentId = payload.id || editingAppointment?.id

    if (!appointmentId) {
      alert(t('appointmentsPage.errors.update', { message: 'Missing appointment id' }))
      return
    }

    try {
      if (media.beforePhotoFile) {
        payload.before_photo_url = await uploadAppointmentPhoto(media.beforePhotoFile, 'before')
      } else if (media.removeBeforePhoto) {
        payload.before_photo_url = null
        if (media.currentBeforePhotoUrl) {
          await deleteAppointmentPhoto(media.currentBeforePhotoUrl)
        }
      }

      if (media.afterPhotoFile) {
        payload.after_photo_url = await uploadAppointmentPhoto(media.afterPhotoFile, 'after')
      } else if (media.removeAfterPhoto) {
        payload.after_photo_url = null
        if (media.currentAfterPhotoUrl) {
          await deleteAppointmentPhoto(media.currentAfterPhotoUrl)
        }
      }
    } catch (photoError) {
      alert(t('appointmentsPage.errors.photoUpload', { message: photoError.message }))
      return
    }

    const { id: _ignored, ...updateData } = payload
    const { data, error } = await updateAppointment(appointmentId, updateData)

    if (error) {
      alert(t('appointmentsPage.errors.update', { message: error.message }))
    } else {
      setShowForm(false)
      setEditingAppointment(null)
      setPrefilledData(null)
      if (data && Array.isArray(data)) {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === data[0].id ? { ...apt, ...data[0] } : apt))
        )
      } else {
        await fetchAppointments()
      }
    }
  }

  const appointmentsToShow = appointments

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (viewSelectorRef.current && !viewSelectorRef.current.contains(event.target)) {
        setViewSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const el = calendarContainerRef.current
    if (!el) return

    const computeHeight = () => {
      const available = el.clientHeight || 0
      if (available <= 0) return
      const gap = 2
      const calculated = Math.max(26, Math.floor((available - gap * (slotsCount + 1)) / slotsCount))
      setSlotHeight(calculated)
    }

    computeHeight()
    const resizeObserver = new ResizeObserver(() => computeHeight())
    resizeObserver.observe(el)

    return () => {
      resizeObserver.disconnect()
    }
  }, [slotsCount])

  const viewOptions = [
    { value: 'calendar', label: t('compactAppointmentsPage.views.calendar') },
    { value: 'list', label: t('compactAppointmentsPage.views.list') }
  ]

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-xl text-gray-600">{t('appointmentsPage.loading')}</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 h-full">
        <div className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white/90 shadow-md p-3 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2" ref={viewSelectorRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setViewSelectorOpen((prev) => !prev)}
                  className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-primary focus:outline-none"
                >
                  <span className="px-2 py-1 rounded-full bg-brand-primary/10 group-hover:bg-brand-primary/15 transition">
                    {viewOptions.find((o) => o.value === viewMode)?.label}
                  </span>
                  <span className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">▾</span>
                </button>
                {viewSelectorOpen && (
                  <div className="absolute z-20 mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                    {viewOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setViewMode(option.value)
                          setViewSelectorOpen(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-sm font-semibold ${
                          viewMode === option.value
                            ? 'text-brand-primary bg-brand-primary/10'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
                <span>{getWeekRangeText(weekOffset, resolvedLocale, { useLongMonth: true })}</span>
                {weekOffset === 0 && <span className="text-brand-primary">· {t('calendar.currentWeek')}</span>}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="rounded-full px-2.5 py-1 text-sm font-semibold text-slate-700 hover:text-brand-primary"
                  aria-label={t('calendar.previous')}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="rounded-full px-2.5 py-1 text-sm font-semibold text-slate-700 hover:text-brand-primary"
                >
                  {t('calendar.today')}
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="rounded-full px-2.5 py-1 text-sm font-semibold text-slate-700 hover:text-brand-primary"
                  aria-label={t('calendar.next')}
                >
                  →
                </button>
              </div>
              <button
                onClick={() => {
                  setEditingAppointment(null)
                  setPrefilledData(null)
                  setShowForm(true)
                }}
                className="btn-brand shadow-brand-glow py-2 px-4 flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span>
                <span>{t('compactAppointmentsPage.actions.new')}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0" ref={calendarContainerRef}>
            {viewMode === 'calendar' ? (
              <>
                <div className="md:hidden space-y-3">
                  <CalendarViewMobile
                    appointments={appointmentsToShow}
                    weekOffset={weekOffset}
                    onWeekChange={setWeekOffset}
                    onEdit={handleEditAppointment}
                    onCreateAtSlot={handleCreateAtSlot}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingAppointment(null)
                        setPrefilledData(null)
                        setShowForm(true)
                      }}
                      className="flex-1 rounded-xl bg-brand-primary text-white text-sm font-semibold py-3 shadow-brand-glow"
                    >
                      {t('compactAppointmentsPage.actions.new')}
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className="rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 px-4 py-3"
                    >
                      {t('compactAppointmentsPage.views.list')}
                    </button>
                  </div>
                </div>
                <div className="hidden md:block h-full">
                  <CalendarView
                    appointments={appointmentsToShow}
                    weekOffset={weekOffset}
                    onWeekChange={setWeekOffset}
                    onComplete={handleMarkCompleted}
                    onEdit={handleEditAppointment}
                    onCreateAtSlot={handleCreateAtSlot}
                    slotHeight={slotHeight}
                    slotGap={2}
                    timeColumnWidth={88}
                    showInstructions={false}
                    showLegend={false}
                    compactCards
                    showMonthNames
                    longMonthToolbar
                    showNavigation={false}
                    className="h-full flex flex-col"
                  />
                </div>
              </>
            ) : (
              <div className="h-full overflow-auto rounded-xl border border-slate-200 bg-white">
                <AppointmentList
                  appointments={appointmentsToShow}
                  filter="all"
                  onComplete={handleMarkCompleted}
                  onDelete={handleDeleteAppointment}
                  onEdit={handleEditAppointment}
                  onTogglePayment={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {sharePreview && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4 py-6">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">
              {t('appointmentForm.sharePreview.title')}
            </h3>
            <p className="text-sm text-slate-600">
              {t('appointmentForm.sharePreview.helper')}
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <pre className="whitespace-pre-wrap text-sm text-slate-800">{sharePreview.message}</pre>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  if (sharePreview.forceRedirect) {
                    window.location.href = sharePreview.waUrl
                  } else {
                    window.open(sharePreview.waUrl, '_blank', 'noopener,noreferrer')
                  }
                  if (sharePreview.id) {
                    markWhatsappSent(sharePreview.id).catch(() => {})
                  }
                  setSharePreview(null)
                }}
                className="w-full rounded-xl bg-emerald-500 text-white font-semibold py-3 hover:bg-emerald-600 transition"
              >
                <span className="inline-flex items-center gap-2 justify-center">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      fill="#25D366"
                      d="M16 3C9.375 3 4 8.373 4 15c0 2.591.782 4.997 2.125 7.009L4 29l7.219-2.09C12.97 27.59 14.455 28 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3Z"
                    />
                    <path
                      fill="#fff"
                      d="M23.484 20.398c-.299.846-1.45 1.545-2.367 1.75-.63.14-1.45.25-4.219-.903-3.538-1.466-5.807-5.063-5.983-5.303-.176-.24-1.426-1.903-1.426-3.63 0-1.726.904-2.572 1.226-2.93.322-.357.703-.446.937-.446.234 0 .468 0 .674.012.217.012.51-.082.798.61.299.716 1.017 2.476 1.108 2.656.09.18.15.39.03.63-.12.24-.18.39-.35.6-.18.216-.37.48-.53.645-.18.18-.37.375-.16.732.21.357.928 1.53 1.993 2.476 1.37 1.226 2.526 1.61 2.883 1.79.357.18.563.15.773-.09.21-.24.896-1.05 1.14-1.41.234-.36.48-.3.804-.18.323.12 2.06.97 2.414 1.144.357.18.59.27.674.42.083.15.083.87-.216 1.716Z"
                    />
                  </svg>
                  {t('appointmentForm.sharePreview.confirm')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSharePreview(null)}
                className="w-full rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold py-3 hover:bg-slate-50 transition"
              >
                {t('appointmentForm.sharePreview.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-primary/10 sm:bg-brand-primary/20 backdrop-blur-none sm:backdrop-blur-md px-3 py-4 sm:px-10 sm:py-12 overflow-y-auto transition"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl sm:shadow-2xl border border-brand-primary/30">
            <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-8">
              <AppointmentForm
                onSubmit={editingAppointment ? handleUpdateAppointment : handleCreateAppointment}
                onCancel={handleCancelEdit}
                initialData={editingAppointment || prefilledData}
                onDelete={
                  editingAppointment ? () => handleDeleteAppointment(editingAppointment.id) : undefined
                }
                onMarkCompleted={
                  editingAppointment ? () => handleMarkCompleted(editingAppointment.id) : undefined
                }
                onShare={openWhatsAppForAppointment}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function generatePhotoPath(tag) {
  const unique =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  return `appointments/${unique}-${tag}.jpg`
}

async function uploadAppointmentPhoto(file, tag) {
  const compressed = await compressImage(file, { maxSize: 1024 })
  const filePath = generatePhotoPath(tag)
  const { error } = await supabase.storage
    .from(APPOINTMENT_PHOTO_BUCKET)
    .upload(filePath, compressed, { upsert: true, contentType: 'image/jpeg' })

  if (error) {
    throw new Error(error.message)
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(APPOINTMENT_PHOTO_BUCKET).getPublicUrl(filePath)

  return publicUrl || null
}

function extractAppointmentStoragePath(url) {
  if (!url) return null
  const marker = `${APPOINTMENT_PHOTO_BUCKET}/`
  const parts = url.split(marker)
  return parts[1] || null
}

async function deleteAppointmentPhoto(url) {
  const path = extractAppointmentStoragePath(url)
  if (!path) return
  await supabase.storage.from(APPOINTMENT_PHOTO_BUCKET).remove([path])
}
