// ============================================
// FILE: components/AppointmentCard.js
// Single appointment card component
// ============================================

'use client'

import Image from 'next/image'
import { formatDate, formatTime } from '@/utils/dateUtils'
import { getGoogleMapsLink, formatAddressForDisplay } from '@/utils/addressUtils'
import { useTranslation } from '@/components/TranslationProvider'

export default function AppointmentCard({ appointment, onComplete, onDelete, onEdit, onTogglePayment }) {
    const { t, resolvedLocale } = useTranslation()
    const mapLabel = t('appointmentCard.addressLink')
    const fallbackAddress = t('appointmentCard.addressMissing')
    const dateText = formatDate(appointment.appointment_date, resolvedLocale)
    const timeText = formatTime(appointment.appointment_time, resolvedLocale)
    const customerName = appointment.customers?.name || t('appointmentCard.unknownCustomer')
    const phoneNumber = appointment.customers?.phone || ''
    const address = appointment.customers?.address
    const petName = appointment.pets?.name || t('appointmentCard.unknownPet')
    const petBreed = appointment.pets?.breed
    const petPhoto = appointment.pets?.photo_url
    const serviceName = appointment.services?.name || t('appointmentCard.unknownService')
    const servicePrice = appointment.services?.price
    const servicePriceLabel =
        servicePrice != null
            ? new Intl.NumberFormat(resolvedLocale, { style: 'currency', currency: 'EUR' }).format(
                  servicePrice
              )
            : null
    const paymentStatus = appointment.payment_status || 'unpaid'
    const phoneDigits = (phoneNumber || '').replace(/\D/g, '')
    const whatsappSentAt = appointment.whatsapp_sent_at
    const confirmationOpenedAt = appointment.confirmation_opened_at

    const handleCardClick = () => {
        if (onEdit) {
            onEdit(appointment)
        }
    }

    const handleCardKeyDown = (event) => {
        if (!onEdit) return
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onEdit(appointment)
        }
    }

    const formatDateTime = (value) => {
        if (!value) return null
        try {
            return new Date(value).toLocaleString(resolvedLocale, {
                dateStyle: 'short',
                timeStyle: 'short'
            })
        } catch {
            return value
        }
    }

    const buildConfirmationUrl = () => {
        if (typeof window === 'undefined') return ''
        if (!appointment?.id || !appointment?.public_token) return ''
        const url = new URL('/appointments/confirm', window.location.origin)
        url.searchParams.set('id', appointment.id)
        url.searchParams.set('token', appointment.public_token)
        return url.toString()
    }

    const handleShareWhatsApp = () => {
        if (typeof window === 'undefined') return
        const confirmationUrl = buildConfirmationUrl()
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

        const detailLines = [
            serviceName && t('appointmentCard.share.service', { service: serviceName }),
            petName && t('appointmentCard.share.pet', { pet: petBreed ? `${petName} (${petBreed})` : petName }),
            address && t('appointmentCard.share.address', { address }),
            confirmationUrl && t('appointmentCard.share.link', { url: confirmationUrl })
        ].filter(Boolean)

        const messageBody = [introMessage, '', ...detailLines].join('\n')

        const waUrl = `https://wa.me/${phoneDigits || ''}?text=${encodeURIComponent(messageBody)}`
        window.open(waUrl, '_blank', 'noopener,noreferrer')
    }

    return (
        <div
            className={`bg-white rounded-lg shadow-md p-5 sm:p-6 border-l-4 ${appointment.status === 'completed'
                ? 'border-brand-accent bg-brand-accent-soft'
                : 'border-brand-primary'
                }`}
            role={onEdit ? 'button' : undefined}
            tabIndex={onEdit ? 0 : -1}
            onClick={handleCardClick}
            onKeyDown={handleCardKeyDown}
        >
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-start">
                    <div className="flex flex-1 items-start gap-3 sm:gap-4">
                        {petPhoto && (
                            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-brand-primary bg-brand-primary-soft flex-shrink-0 shadow-sm">
                                <Image
                                    src={petPhoto}
                                    alt={t('appointmentCard.labels.petPhotoAlt', {
                                        pet: petName
                                    })}
                                    width={80}
                                    height={80}
                                    sizes="(max-width: 640px) 80px, 96px"
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    decoding="async"
                                    unoptimized
                                />
                            </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-bold text-gray-800">
                                    {customerName}
                                </h3>
                                {appointment.status === 'completed' && (
                                    <span className="bg-brand-accent text-white text-xs font-semibold px-2 py-1 rounded">
                                        ✓ {t('appointmentCard.statusCompleted')}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center gap-1 rounded-full border border-brand-primary bg-white px-3 py-1 text-xs font-semibold text-brand-primary shadow-sm">
                                    📅 <span>{dateText}</span>
                                </div>
                                <div className="inline-flex items-center gap-1 rounded-full border border-brand-primary bg-white px-3 py-1 text-xs font-semibold text-brand-primary shadow-sm">
                                    ⏱ <span>{timeText}</span>
                                </div>
                                {servicePriceLabel && (
                                    <div className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                                        <span>💰</span>
                                        <span>{servicePriceLabel}</span>
                                    </div>
                                )}
                                <div
                                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
                                        paymentStatus === 'paid'
                                            ? 'border-green-200 bg-green-50 text-green-700'
                                            : 'border-orange-200 bg-orange-100 text-orange-800'
                                    }`}
                                >
                                    <span>{paymentStatus === 'paid' ? '💳' : '💸'}</span>
                                    <span>
                                        {paymentStatus === 'paid'
                                            ? t('appointmentCard.payment.paid')
                                            : t('appointmentCard.payment.unpaid')}
                                    </span>
                                </div>
                                {whatsappSentAt && (
                                    <div className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                                        <span aria-hidden="true">
                                            <svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fill="#25D366" d="M16 3C9.375 3 4 8.373 4 15c0 2.591.782 4.997 2.125 7.009L4 29l7.219-2.09C12.97 27.59 14.455 28 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3Z" />
                                                <path fill="#fff" d="M23.484 20.398c-.299.846-1.45 1.545-2.367 1.75-.63.14-1.45.25-4.219-.903-3.538-1.466-5.807-5.063-5.983-5.303-.176-.24-1.426-1.903-1.426-3.63 0-1.726.904-2.572 1.226-2.93.322-.357.703-.446.937-.446.234 0 .468 0 .674.012.217.012.51-.082.798.61.299.716 1.017 2.476 1.108 2.656.09.18.15.39.03.63-.12.24-.18.39-.35.6-.18.216-.37.48-.53.645-.18.18-.37.375-.16.732.21.357.928 1.53 1.993 2.476 1.37 1.226 2.526 1.61 2.883 1.79.357.18.563.15.773-.09.21-.24.896-1.05 1.14-1.41.234-.36.48-.3.804-.18.323.12 2.06.97 2.414 1.144.357.18.59.27.674.42.083.15.083.87-.216 1.716Z" />
                                            </svg>
                                        </span>
                                        <span>
                                            {t('appointmentCard.labels.whatsappSent')}
                                            <span className="ml-1 text-[10px] text-emerald-800/80">
                                                {formatDateTime(whatsappSentAt)}
                                            </span>
                                        </span>
                                    </div>
                                )}
                                {confirmationOpenedAt && (
                                    <div className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                                        👀{' '}
                                        <span>
                                            {t('appointmentCard.labels.confirmationOpened')}
                                            <span className="ml-1 text-[10px] text-blue-800/80">
                                                {formatDateTime(confirmationOpenedAt)}
                                            </span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-1 space-y-1 text-sm text-gray-700 sm:text-base">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{t('appointmentCard.labels.pet')}:</span>
                                    <span className="font-medium">
                                        {petName}
                                        {petBreed && (
                                            <span className="text-gray-500 font-normal text-sm">
                                                {' '}
                                                ({petBreed})
                                            </span>
                                        )}
                                    </span>
                                </div>
                                {phoneNumber && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{t('appointmentCard.labels.phone')}:</span>
                                        <a
                                            href={`tel:${phoneNumber}`}
                                            className="font-medium text-brand-primary underline-offset-4 hover:underline"
                                        >
                                            {phoneNumber}
                                        </a>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{t('appointmentCard.labels.service')}:</span>
                                    <span className="font-medium">{serviceName}</span>
                                </div>
                                {address && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold">{t('appointmentCard.labels.address')}:</span>
                                        <a
                                            href={getGoogleMapsLink(address)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-brand-primary hover:underline flex items-center gap-1"
                                        >
                                            {formatAddressForDisplay(address, {
                                                mapLabel,
                                                emptyLabel: fallbackAddress
                                            })}
                                            <span className="text-xs">🗺️</span>
                                        </a>
                                    </div>
                                )}
                                {appointment.notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <span className="font-bold">{t('appointmentCard.labels.notes')}:</span>
                                        <p className="mt-1 font-medium text-gray-700">{appointment.notes}</p>
                                    </div>
                                )}
                                {(appointment.before_photo_url || appointment.after_photo_url) && (
                                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                                        <span className="font-bold">
                                            {t('appointmentCard.labels.beforeAfter')}
                                        </span>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {appointment.before_photo_url && (
                                                <div>
                                                    <p className="mb-1 text-xs text-gray-500">
                                                        {t('appointmentCard.labels.before')}
                                                    </p>
                                                    <Image
                                                        src={appointment.before_photo_url}
                                                        alt={t('appointmentCard.labels.before')}
                                                        width={120}
                                                        height={120}
                                                        sizes="(max-width: 640px) 45vw, 120px"
                                                        className="h-24 w-full rounded-lg border border-brand-primary object-cover"
                                                        loading="lazy"
                                                        decoding="async"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}
                                            {appointment.after_photo_url && (
                                                <div>
                                                    <p className="mb-1 text-xs text-gray-500">
                                                        {t('appointmentCard.labels.after')}
                                                    </p>
                                                    <Image
                                                        src={appointment.after_photo_url}
                                                        alt={t('appointmentCard.labels.after')}
                                                        width={120}
                                                        height={120}
                                                        sizes="(max-width: 640px) 45vw, 120px"
                                                        className="h-24 w-full rounded-lg border border-brand-accent object-cover"
                                                        loading="lazy"
                                                        decoding="async"
                                                        unoptimized
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handleShareWhatsApp()
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 sm:w-auto"
                    >
                        <svg
                            width="16"
                            height="16"
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
                        <span className="hidden sm:inline">{t('appointmentCard.buttons.share')}</span>
                        <span className="sm:hidden">{t('appointmentCard.buttons.shareShort')}</span>
                    </button>
                    {onTogglePayment && paymentStatus !== 'paid' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onTogglePayment(appointment)
                            }}
                            className="inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition sm:w-auto border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                            <span>💳</span>
                            <span className="hidden sm:inline">
                                {t('appointmentCard.buttons.markPaid')}
                            </span>
                            <span className="sm:hidden">
                                {t('appointmentCard.buttons.markPaidShort')}
                            </span>
                        </button>
                    )}
                    {appointment.status !== 'completed' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onComplete(appointment.id)
                            }}
                            className="inline-flex items-center justify-center gap-1 rounded-full bg-brand-accent px-3 py-2 text-sm font-semibold text-brand-secondary transition hover:bg-brand-accent-dark hover:text-white sm:w-auto"
                        >
                            ✓
                            <span className="hidden sm:inline">{t('appointmentCard.buttons.complete')}</span>
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDelete(appointment.id)
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 sm:w-auto"
                    >
                        🗑
                        <span className="hidden sm:inline">{t('appointmentCard.buttons.delete')}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
