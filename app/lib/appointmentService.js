// ============================================
// FILE: lib/appointmentService.js
// Database operations for appointments
// ============================================

import { supabase } from './supabase'
import { getCurrentAccountId } from './accountHelpers'
import { apiGet, apiPost, apiPatch, hasExternalApi } from './apiClient'
import { getStoredAccessToken } from './authTokens'

const APPOINTMENT_SELECT = `
    *,
    public_token,
    confirmation_opened_at,
    whatsapp_sent_at,
    customers (
        id,
        first_name,
        last_name,
        phone,
        nif,
        address
    ),
    appointment_services (
        id,
        service_id,
        price_tier_id,
        price_tier_label,
        price_tier_price,
        services (
            id,
            name,
            price,
            display_order
        ),
        appointment_service_addons (
            id,
            service_addon_id,
            name,
            price
        )
    )
`

async function getApiToken() {
    return getStoredAccessToken() || null
}

/**
 * Load all appointments from the database with customer data
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function loadAppointments() {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiGet('/appointments', { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .eq('account_id', accountId)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true })

    return { data: data || [], error }
}

/**
 * Create a new appointment
 * @param {Object} appointmentData - Appointment data to insert
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function createAppointment(appointmentData) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiPost('/appointments', appointmentData, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const {
        service_ids: serviceIdsFromPayload,
        service_selections: serviceSelections,
        ...rest
    } = appointmentData || {}
    const payload = { payment_status: 'unpaid', ...rest, account_id: accountId }
    const { data, error } = await supabase
        .from('appointments')
        .insert([payload])
        .select(APPOINTMENT_SELECT)

    if (error) {
        return { data: data || [], error }
    }

    const created = data?.[0]
    if (created?.id) {
        const serviceIds = Array.isArray(serviceIdsFromPayload)
            ? serviceIdsFromPayload
            : (payload.service_id ? [payload.service_id] : [])

        if (serviceIds.length > 0) {
            await supabase
                .from('appointment_services')
                .insert(serviceIds.map((serviceId) => ({
                    appointment_id: created.id,
                    service_id: serviceId
                })))
        }

        if (Array.isArray(serviceSelections) && serviceSelections.length > 0) {
            await applyServiceSelectionsToAppointment({
                appointmentId: created.id,
                selections: serviceSelections
            })
        }
    }

    return { data: data || [], error: null }
}

/**
 * Update an appointment's status
 * @param {string} id - Appointment ID
 * @param {string} status - New status value
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function updateAppointmentStatus(id, status) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiPatch(`/appointments/${id}/status`, { status }, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('account_id', accountId)
        .eq('id', id)
        .select(APPOINTMENT_SELECT)

    return { data, error }
}

/**
 * Update an appointment's data
 * @param {string} id - Appointment ID
 * @param {Object} appointmentData - Updated appointment data
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function updateAppointment(id, appointmentData) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiPatch(`/appointments/${id}`, appointmentData, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }

    const accountId = await getCurrentAccountId()
    const {
        service_ids: serviceIdsFromPayload,
        service_selections: serviceSelections,
        ...rest
    } = appointmentData || {}
    const { data, error } = await supabase
        .from('appointments')
        .update(rest)
        .eq('account_id', accountId)
        .eq('id', id)
        .select(APPOINTMENT_SELECT)

    if (error) {
        return { data, error }
    }

    const serviceIds = Array.isArray(serviceIdsFromPayload)
        ? serviceIdsFromPayload
        : (rest.service_id ? [rest.service_id] : null)

    if (serviceIds && serviceIds.length >= 0) {
        await supabase
            .from('appointment_services')
            .delete()
            .eq('appointment_id', id)

        if (serviceIds.length > 0) {
            await supabase
                .from('appointment_services')
                .insert(serviceIds.map((serviceId) => ({
                    appointment_id: id,
                    service_id: serviceId
                })))
        }
    }

    if (Array.isArray(serviceSelections) && serviceSelections.length > 0) {
        await applyServiceSelectionsToAppointment({
            appointmentId: id,
            selections: serviceSelections
        })
    }

    const shouldRefresh =
        Array.isArray(serviceIds) ||
        (Array.isArray(serviceSelections) && serviceSelections.length > 0)
    if (!shouldRefresh) {
        return { data, error: null }
    }

    const { data: refreshed, error: refreshError } = await supabase
        .from('appointments')
        .select(APPOINTMENT_SELECT)
        .eq('account_id', accountId)
        .eq('id', id)

    if (refreshError || !refreshed) {
        return { data, error: null }
    }

    return { data: refreshed, error: null }
}

async function applyServiceSelectionsToAppointment({ appointmentId, selections }) {
    if (!Array.isArray(selections) || selections.length === 0) return

    const { data: appointmentServices } = await supabase
        .from('appointment_services')
        .select('id, service_id')
        .eq('appointment_id', appointmentId)

    const serviceToAppointmentService = new Map(
        (appointmentServices || []).map((row) => [row.service_id, row.id])
    )

    for (const selection of selections) {
        const serviceId = selection?.service_id
        const appointmentServiceId = serviceToAppointmentService.get(serviceId)
        if (!appointmentServiceId) continue

        if (Object.prototype.hasOwnProperty.call(selection, 'price_tier_id')) {
            let tierPayload = {
                price_tier_id: null,
                price_tier_label: null,
                price_tier_price: null
            }

            if (selection.price_tier_id) {
                const { data: tierData } = await supabase
                    .from('service_price_tiers')
                    .select('id, label, price, service_id')
                    .eq('id', selection.price_tier_id)
                    .maybeSingle()
                if (tierData && tierData.service_id === serviceId) {
                    tierPayload = {
                        price_tier_id: tierData.id,
                        price_tier_label: tierData.label,
                        price_tier_price: tierData.price
                    }
                }
            }

            await supabase
                .from('appointment_services')
                .update(tierPayload)
                .eq('id', appointmentServiceId)
        }

        if (Object.prototype.hasOwnProperty.call(selection, 'addon_ids')) {
            await supabase
                .from('appointment_service_addons')
                .delete()
                .eq('appointment_service_id', appointmentServiceId)

            const addonIds = Array.isArray(selection.addon_ids) ? selection.addon_ids : []
            if (addonIds.length > 0) {
                const { data: addonsData } = await supabase
                    .from('service_addons')
                    .select('id, name, price')
                    .in('id', addonIds)

                const rows = (addonsData || []).map((addon) => ({
                    appointment_service_id: appointmentServiceId,
                    service_addon_id: addon.id,
                    name: addon.name,
                    price: addon.price
                }))

                if (rows.length > 0) {
                    await supabase.from('appointment_service_addons').insert(rows)
                }
            }
        }
    }
}

/**
 * Update payment status for an appointment
 * @param {string} id - Appointment ID
 * @param {string} payment_status - 'paid' or 'unpaid'
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function updateAppointmentPaymentStatus(id, payment_status) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .update({ payment_status })
        .eq('account_id', accountId)
        .eq('id', id)
        .select(APPOINTMENT_SELECT)

    return { data, error }
}

/**
 * Delete an appointment
 * @param {string} id - Appointment ID to delete
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function deleteAppointment(id) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .delete()
        .eq('account_id', accountId)
        .eq('id', id)

    return { data, error }
}

/**
 * Filter appointments based on criteria
 * @param {Object[]} appointments - Array of appointments to filter
 * @param {string} filter - Filter type: 'all', 'upcoming', 'completed'
 * @returns {Object[]} Filtered appointments
 */
export function filterAppointments(appointments, filter) {
    const today = new Date().toISOString().split('T')[0]

    switch (filter) {
        case 'upcoming':
            return appointments.filter(apt =>
                !['completed', 'cancelled'].includes(apt.status) && apt.appointment_date >= today
            )
        case 'completed':
            return appointments.filter(apt => apt.status === 'completed')
        default:
            return appointments
    }
}

/**
 * Mark WhatsApp as sent for an appointment
 * @param {string} id - Appointment ID
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function markWhatsappSent(id) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .update({ whatsapp_sent_at: new Date().toISOString() })
        .eq('account_id', accountId)
        .eq('id', id)
        .select(APPOINTMENT_SELECT)

    return { data, error }
}
