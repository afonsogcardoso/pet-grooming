// ============================================
// FILE: components/AppointmentList.js
// List of appointments component
// ============================================

'use client'

import { useTranslation } from '@/components/TranslationProvider'
import AppointmentCard from './AppointmentCard'

export default function AppointmentList({ appointments, filter, onComplete, onDelete, onEdit, onTogglePayment }) {
    const { t } = useTranslation()
    const filterLabels = {
        all: t('filterButtons.all'),
        upcoming: t('filterButtons.upcoming'),
        completed: t('filterButtons.completed')
    }

    if (appointments.length === 0) {
        const title =
            filter === 'all'
                ? t('appointmentList.emptyAllTitle')
                : t('appointmentList.emptyFilteredTitle', { filter: filterLabels[filter] || '' })
        const description =
            filter === 'all'
                ? t('appointmentList.emptyAllDescription')
                : t('appointmentList.emptyFilteredDescription')

        return (
            <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
                <div className="text-6xl mb-4">📅</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">{title}</h3>
                <p className="text-gray-500">{description}</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {appointments.map((appointment) => (
                <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    onComplete={onComplete}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onTogglePayment={onTogglePayment}
                />
            ))}
        </div>
    )
}
