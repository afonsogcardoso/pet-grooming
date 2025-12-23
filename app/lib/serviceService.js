// ============================================
// FILE: lib/serviceService.js
// Service catalog operations
// ============================================

import { supabase } from './supabase'
import { getCurrentAccountId } from './accountHelpers'
import { apiGet, apiPost, apiPatch, apiDelete, hasExternalApi } from './apiClient'
import { getStoredAccessToken } from './authTokens'

async function getApiToken() {
  return getStoredAccessToken() || null
}

export async function loadServices({ includeInactive = false } = {}) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiGet('/services', { token })
      let services = (body?.data || []).map((svc) => ({
        ...svc,
        duration: svc.duration ?? svc.default_duration
      }))
      if (!includeInactive) {
        services = services.filter((svc) => svc.active !== false)
      }
      return { data: services, error: null }
    } catch (error) {
      return { data: [], error }
    }
  }
  const accountId = await getCurrentAccountId()
  let query = supabase
    .from('services')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('active', true)
  }
  const { data, error } = await query

  return { data: data || [], error }
}

export async function createService(serviceData) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPost('/services', {
        ...serviceData,
        default_duration: serviceData.duration
      }, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }
  const accountId = await getCurrentAccountId()
  const payload = { ...serviceData, account_id: accountId }

  const { data, error } = await supabase.from('services').insert([payload]).select()

  return { data: data || [], error }
}

export async function updateService(id, serviceData) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPatch(`/services/${id}`, {
        ...serviceData,
        default_duration: serviceData.duration
      }, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }
  const accountId = await getCurrentAccountId()
  const { data, error } = await supabase
    .from('services')
    .update(serviceData)
    .eq('account_id', accountId)
    .eq('id', id)
    .select()

  return { data, error }
}

export async function deleteService(id) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      await apiPatch(`/services/${id}`, { _delete: true }, { token })
      return { error: null }
    } catch (error) {
      return { error }
    }
  }
  const accountId = await getCurrentAccountId()
  const { error } = await supabase.from('services').delete().eq('account_id', accountId).eq('id', id)
  return { error }
}

export async function loadServicePriceTiers(serviceId) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiGet(`/services/${serviceId}/price-tiers`, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_price_tiers')
    .select('*')
    .eq('service_id', serviceId)
    .order('display_order', { ascending: true })
    .order('min_weight_kg', { ascending: true })

  return { data: data || [], error }
}

export async function createServicePriceTier(serviceId, payload) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPost(`/services/${serviceId}/price-tiers`, payload, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_price_tiers')
    .insert([{ ...payload, service_id: serviceId }])
    .select()

  return { data: data || [], error }
}

export async function updateServicePriceTier(serviceId, tierId, payload) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPatch(`/services/${serviceId}/price-tiers/${tierId}`, payload, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_price_tiers')
    .update(payload)
    .eq('service_id', serviceId)
    .eq('id', tierId)
    .select()

  return { data: data || [], error }
}

export async function deleteServicePriceTier(serviceId, tierId) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      await apiDelete(`/services/${serviceId}/price-tiers/${tierId}`, { token })
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const { error } = await supabase
    .from('service_price_tiers')
    .delete()
    .eq('service_id', serviceId)
    .eq('id', tierId)

  return { error }
}

export async function loadServiceAddons(serviceId) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiGet(`/services/${serviceId}/addons`, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_addons')
    .select('*')
    .eq('service_id', serviceId)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  return { data: data || [], error }
}

export async function createServiceAddon(serviceId, payload) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPost(`/services/${serviceId}/addons`, payload, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_addons')
    .insert([{ ...payload, service_id: serviceId }])
    .select()

  return { data: data || [], error }
}

export async function updateServiceAddon(serviceId, addonId, payload) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      const body = await apiPatch(`/services/${serviceId}/addons/${addonId}`, payload, { token })
      return { data: body?.data || [], error: null }
    } catch (error) {
      return { data: [], error }
    }
  }

  const { data, error } = await supabase
    .from('service_addons')
    .update(payload)
    .eq('service_id', serviceId)
    .eq('id', addonId)
    .select()

  return { data: data || [], error }
}

export async function deleteServiceAddon(serviceId, addonId) {
  if (hasExternalApi()) {
    try {
      const token = await getApiToken()
      if (!token) throw new Error('Not authenticated')
      await apiDelete(`/services/${serviceId}/addons/${addonId}`, { token })
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const { error } = await supabase
    .from('service_addons')
    .delete()
    .eq('service_id', serviceId)
    .eq('id', addonId)

  return { error }
}
