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
        name,
        phone,
        nif,
        address
    ),
    pets (
        id,
        name,
        breed,
        photo_url
    ),
    services (
        id,
        name,
        description,
        default_duration,
        price
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
    const payload = { payment_status: 'unpaid', ...appointmentData, account_id: accountId }
    const { data, error } = await supabase
        .from('appointments')
        .insert([payload])
        .select(APPOINTMENT_SELECT)

    return { data: data || [], error }
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
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .update(appointmentData)
        .eq('account_id', accountId)
        .eq('id', id)
        .select(APPOINTMENT_SELECT)

    return { data, error }
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
                apt.status !== 'completed' && apt.appointment_date >= today
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
