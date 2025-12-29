// ============================================
// FILE: components/CalendarViewMobile.js
// Mobile-first calendar view focused on quick scheduling
// ============================================

'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { getWeekDates, getWeekRangeText, formatTime } from '@/utils/dateUtils'
import { getGoogleMapsLink } from '@/utils/addressUtils'
import { useTranslation } from '@/components/TranslationProvider'
import { formatCustomerName } from '@/lib/customerName'

export default function CalendarViewMobile({
  appointments,
  weekOffset,
  onWeekChange,
  onEdit,
  onCreateAtSlot
}) {
  const { t, resolvedLocale } = useTranslation()
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const days = weekDates

  const SLOT_INTERVAL_MINUTES = 30
  const START_TIME_MINUTES = 9 * 60
  const END_TIME_MINUTES = 18 * 60
  const SLOT_HEIGHT = 52
  const SLOT_GAP = 4
  const TIME_COLUMN_WIDTH = 72
  const DAY_MIN_WIDTH = 220
  const gridTemplateColumns = `${TIME_COLUMN_WIDTH}px repeat(${days.length}, ${DAY_MIN_WIDTH}px)`

  const timeSlots = useMemo(() => {
    const slots = []
    for (let minutes = START_TIME_MINUTES; minutes <= END_TIME_MINUTES; minutes += SLOT_INTERVAL_MINUTES) {
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
    }
    return slots
  }, [START_TIME_MINUTES, END_TIME_MINUTES])

  const normalizeTimeToSlot = (time) => {
    if (!time) return null
    const [hour, minute] = time.split(':')
    if (hour === undefined || minute === undefined) return null
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  const getAppointmentsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0]
    return (appointments || [])
      .filter((apt) => apt.appointment_date === dateStr)
      .map((apt) => {
        const normalizedTime = normalizeTimeToSlot(apt.appointment_time)
        if (!normalizedTime) return null
        const [hour, minute] = normalizedTime.split(':').map(Number)
        const minutesFromStart = hour * 60 + minute - START_TIME_MINUTES
        if (Number.isNaN(minutesFromStart) || minutesFromStart < 0) return null
        const slotIndex = minutesFromStart / SLOT_INTERVAL_MINUTES
        const durationMinutes = Math.max(SLOT_INTERVAL_MINUTES, apt.duration || 60)
        const slotsToRender = Math.max(1, durationMinutes / SLOT_INTERVAL_MINUTES)
        return {
          ...apt,
          slotIndex,
          slotsToRender,
          startMinutes: hour * 60 + minute,
          endMinutes: hour * 60 + minute + durationMinutes
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.slotIndex - b.slotIndex)
  }

  const handleSlotClick = (date, time) => {
    const dateStr = date.toISOString().split('T')[0]
    const existing = getAppointmentsForDate(date).find(
      (apt) => normalizeTimeToSlot(apt.appointment_time) === time
    )
    if (existing) {
      onEdit(existing)
      return
    }
    onCreateAtSlot?.(dateStr, time)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="text-sm font-semibold text-slate-800">
          {getWeekRangeText(weekOffset, resolvedLocale, { useLongMonth: true })}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <button
            type="button"
            onClick={() => onWeekChange(weekOffset - 1)}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:border-brand-primary"
            aria-label={t('calendar.previous')}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(0)}
            className="px-2 py-1 rounded-full bg-brand-primary text-white shadow-brand-glow"
          >
            {t('calendar.today')}
          </button>
          <button
            type="button"
            onClick={() => onWeekChange(weekOffset + 1)}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white hover:border-brand-primary"
            aria-label={t('calendar.next')}
          >
            ›
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="relative overflow-x-auto no-scrollbar">
          <div className="min-w-[420px]">
            <div
              className="grid gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2"
              style={{ gridTemplateColumns }}
            >
              <div className="flex items-center justify-center text-center text-xs font-semibold text-slate-600 sticky left-0 top-0 z-40 bg-slate-50 h-full min-h-[40px]">
                {t('calendar.timeColumn')}
              </div>
              {days.map((date, idx) => {
                const isToday = date.toDateString() === new Date().toDateString()
                return (
                  <div key={idx} className="text-center sticky top-0 z-20 bg-slate-50">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {date.toLocaleDateString(resolvedLocale, { weekday: 'short' })}
                    </div>
                    <div
                      className={`mx-auto mt-1 h-8 w-8 rounded-full text-sm font-bold flex items-center justify-center ${
                        isToday ? 'bg-brand-primary text-white' : 'bg-white text-slate-700 border border-slate-200'
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              className="grid gap-1"
              style={{ gridTemplateColumns }}
            >
              <div className="flex flex-col gap-1 bg-white sticky left-0 z-40 shadow-[4px_0_12px_-10px_rgba(15,23,42,0.45)]">
                {timeSlots.map((time) => (
                  <div
                    key={time}
                    className="flex items-center justify-center text-center text-xs font-semibold text-slate-600 px-1 py-2 border-b border-slate-100 bg-white"
                    style={{ height: SLOT_HEIGHT }}
                  >
                    {formatTime(time, resolvedLocale)}
                  </div>
                ))}
              </div>

              {days.map((date, columnIndex) => {
                const isToday = date.toDateString() === new Date().toDateString()
                const appointmentsForDay = getAppointmentsForDate(date)
                const dateStr = date.toISOString().split('T')[0]

                return (
                  <div
                    key={columnIndex}
                    className="relative border-l border-slate-100"
                  >
                    <div className="flex flex-col gap-1">
                      {timeSlots.map((time) => {
                        const [slotHour, slotMinute] = time.split(':').map(Number)
                        const slotStartMinutes = slotHour * 60 + slotMinute
                        const slotEndMinutes = slotStartMinutes + SLOT_INTERVAL_MINUTES
                        const hasAppointment = appointmentsForDay.some(
                          (apt) =>
                            !(apt.endMinutes <= slotStartMinutes || apt.startMinutes >= slotEndMinutes)
                        )
                        return (
                          <button
                            key={`${dateStr}-${time}`}
                            type="button"
                            className={`group w-full text-left p-2 border-b border-slate-100 text-[11px] font-semibold rounded ${isToday ? 'bg-brand-primary-soft/60' : 'bg-slate-50'
                              } ${hasAppointment ? 'opacity-60' : 'hover:bg-slate-100'}`}
                            style={{ height: SLOT_HEIGHT }}
                            onClick={() => handleSlotClick(date, time)}
                          >
                            {!hasAppointment && (
                              <span className="text-slate-400">{t('calendar.add')}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {appointmentsForDay.map((apt) => {
                      const customerName = formatCustomerName(apt.customers) || t('appointmentCard.unknownCustomer')
                      const petName = apt.pets?.name || t('appointmentCard.unknownPet')
                      const petBreed = apt.pets?.breed
                      const serviceName = apt.services?.name || t('appointmentCard.unknownService')
                      const top = apt.slotIndex * (SLOT_HEIGHT + SLOT_GAP)
                      const height =
                        apt.slotsToRender * SLOT_HEIGHT + (apt.slotsToRender - 1) * SLOT_GAP
                      return (
                        <div
                          key={apt.id}
                          className={`absolute left-1 right-1 rounded-lg border px-2 py-1 text-[11px] shadow-sm ${
                            apt.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : apt.status === 'cancelled'
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : apt.status === 'in_progress'
                                  ? 'bg-orange-50 border-orange-200 text-orange-800'
                                  : apt.status === 'pending'
                                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                                    : 'bg-brand-primary-soft border-brand-primary text-slate-900'
                          } ${isToday ? 'ring-2 ring-brand-primary/60' : ''}`}
                          style={{ top, height }}
                          onClick={() => onEdit(apt)}
                        >
                          <div className="font-semibold truncate">{customerName}</div>
                          <div className="truncate">
                            {petName}
                            {petBreed && <span className="text-slate-600"> ({petBreed})</span>}
                          </div>
                          <div className="truncate text-[10px] text-slate-700">{serviceName}</div>
                          {apt.pets?.photo_url && (
                            <div className="mt-1">
                              <Image
                                src={apt.pets.photo_url}
                                alt={petName}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full object-cover border border-white"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
