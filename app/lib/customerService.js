// ============================================
// FILE: lib/customerService.js
// Customer and Pet database operations
// ============================================

import { supabase } from './supabase'
import { getCurrentAccountId } from './accountHelpers'
import { apiGet, apiPost, apiPatch, hasExternalApi } from './apiClient'
import { getStoredAccessToken } from './authTokens'
import { buildPhone, splitPhone } from './phone'

async function getApiToken() {
    return getStoredAccessToken() || null
}

// ==================== CUSTOMERS ====================

/**
 * Load all customers with pet and appointment counts
 * @returns {Promise<Object>} Object with data and error properties
 */
async function fetchCustomersWithRelations(accountId) {
    const { data, error } = await supabase
        .from('customers')
        .select(`
            *,
            pets (id, name, breed),
            appointments (id)
        `)
        .eq('account_id', accountId)
        .order('name', { ascending: true })

    return { data: data || [], error }
}

function applyPhoneFields(payload = {}) {
    if (!payload.phone) return payload
    const parts = splitPhone(payload.phone)
    const normalizedPhone = buildPhone(parts.phoneCountryCode, parts.phoneNumber)
    return {
        ...payload,
        phone: normalizedPhone || payload.phone,
        phone_country_code: parts.phoneCountryCode,
        phone_number: parts.phoneNumber
    }
}

export async function loadCustomers() {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiGet('/customers', { token })
            const customers = (body?.data || []).map((customer) => ({
                ...customer,
                pet_count: customer.pet_count ?? (customer.pets ? customer.pets.length : 0)
            }))
            return { data: customers, error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const { data, error } = await fetchCustomersWithRelations(accountId)

    const customersWithCounts = data.map((customer) => ({
        ...customer,
        pet_count: customer.pets ? customer.pets.length : 0,
        appointment_count: customer.appointments ? customer.appointments.length : 0,
        pets: undefined,
        appointments: undefined
    }))

    return { data: customersWithCounts, error }
}

/**
 * Load a lightweight index of customers and their pets for quick searches
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function loadCustomerPetSearchIndex() {
    const accountId = await getCurrentAccountId()
    const { data, error } = await fetchCustomersWithRelations(accountId)

    if (error) {
        return { data: [], error }
    }

    const entries = data.flatMap((customer) => {
        if (!customer.pets?.length) {
            return []
        }

        return customer.pets.map((pet) => ({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_nif: customer.nif,
            customer_address: customer.address,
            pet_id: pet.id,
            pet_name: pet.name,
            pet_breed: pet.breed || ''
        }))
    })

    entries.sort((a, b) => {
        return a.pet_name.localeCompare(b.pet_name)
    })

    return { data: entries, error: null }
}

/**
 * Get a single customer by ID
 * @param {string} id - Customer ID
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function getCustomer(id) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiGet(`/customers?id=${id}`, { token })
            const found = (body?.data || []).find((c) => c.id === id) || null
            return { data: found, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('account_id', accountId)
        .eq('id', id)
        .single()

    return { data, error }
}

/**
 * Create a new customer
 * @param {Object} customerData - Customer data to insert
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function createCustomer(customerData) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiPost('/customers', customerData, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const payload = { ...applyPhoneFields(customerData), account_id: accountId }
    const { data, error } = await supabase
        .from('customers')
        .insert([payload])
        .select()

    return { data: data || [], error }
}

/**
 * Update a customer
 * @param {string} id - Customer ID
 * @param {Object} customerData - Updated customer data
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function updateCustomer(id, customerData) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiPatch(`/customers/${id}`, customerData, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('customers')
        .update(applyPhoneFields(customerData))
        .eq('account_id', accountId)
        .eq('id', id)
        .select()

    return { data, error }
}

/**
 * Delete a customer
 * @param {string} id - Customer ID to delete
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function deleteCustomer(id) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('customers')
        .delete()
        .eq('account_id', accountId)
        .eq('id', id)

    return { data, error }
}

/**
 * Search customers by name or phone
 * @param {string} searchTerm - Search term
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function searchCustomers(searchTerm) {
    const term = searchTerm?.trim()
    if (!term) {
        return loadCustomers()
    }

    const lowerTerm = term.toLowerCase()
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiGet('/customers', { token })
            const source = body?.data || []
            const filtered = source.filter((customer) => {
                const matchesField = [
                    customer.name,
                    customer.phone,
                    customer.nif,
                    customer.email,
                    customer.address,
                    customer.notes
                ].some((value) => value?.toLowerCase().includes(lowerTerm))
                const matchesPet = (customer.pets || []).some((pet) =>
                    pet.name?.toLowerCase().includes(lowerTerm)
                )
                return matchesField || matchesPet
            })
            return { data: filtered, error: null }
        } catch (error) {
            return { data: [], error }
        }
    }

    const accountId = await getCurrentAccountId()
    const { data, error } = await fetchCustomersWithRelations(accountId)

    if (error) {
        return { data: [], error }
    }

    const filtered = data.filter((customer) => {
        const matchesField = [
            customer.name,
            customer.phone,
            customer.nif,
            customer.email,
            customer.address,
            customer.notes
        ].some((value) => value?.toLowerCase().includes(lowerTerm))

        const matchesPet = customer.pets?.some((pet) =>
            pet.name?.toLowerCase().includes(lowerTerm)
        )

        return matchesField || matchesPet
    })

    const customersWithCounts = filtered.map((customer) => ({
        ...customer,
        pet_count: customer.pets ? customer.pets.length : 0,
        appointment_count: customer.appointments ? customer.appointments.length : 0,
        pets: undefined,
        appointments: undefined
    }))

    return { data: customersWithCounts, error: null }
}

// ==================== PETS ====================

/**
 * Load all pets for a customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function loadPetsByCustomer(customerId) {
    if (hasExternalApi()) {
        try {
            const token = await getApiToken()
            if (!token) throw new Error('Not authenticated')
            const body = await apiGet(`/customers/${customerId}/pets`, { token })
            return { data: body?.data || [], error: null }
        } catch (error) {
            return { data: [], error }
        }
    }

    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('account_id', accountId)
        .eq('customer_id', customerId)
        .order('name', { ascending: true })

    return { data: data || [], error }
}

/**
 * Get a single pet by ID
 * @param {string} id - Pet ID
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function getPet(id) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('account_id', accountId)
        .eq('id', id)
        .single()

    return { data, error }
}

/**
 * Create a new pet
 * @param {Object} petData - Pet data to insert
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function createPet(petData) {
    const accountId = await getCurrentAccountId()
    const payload = { ...petData, account_id: accountId }
    const { data, error } = await supabase.from('pets').insert([payload]).select()
    return { data: data || [], error }
}

/**
 * Update a pet
 * @param {string} id - Pet ID
 * @param {Object} petData - Updated pet data
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function updatePet(id, petData) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('pets')
        .update(petData)
        .eq('account_id', accountId)
        .eq('id', id)
        .select()
    return { data, error }
}

/**
 * Delete a pet
 * @param {string} id - Pet ID to delete
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function deletePet(id) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('pets')
        .delete()
        .eq('account_id', accountId)
        .eq('id', id)

    return { data, error }
}

// ==================== APPOINTMENTS WITH CUSTOMER/PET ====================

/**
 * Load appointments for a specific customer
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} Object with data and error properties
 */
export async function loadCustomerAppointments(customerId) {
    const accountId = await getCurrentAccountId()
    const { data, error } = await supabase
        .from('appointments')
        .select(`
            *,
            customers (name, phone, nif),
            pets (name),
            services (name)
        `)
        .eq('account_id', accountId)
        .eq('customer_id', customerId)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })

    return { data: data || [], error }
}
