import { Router } from 'express'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()

const MARKETPLACE_ACCOUNT_SELECT = [
  'id',
  'name',
  'slug',
  'logo_url',
  'portal_image_url',
  'support_email',
  'support_phone',
  'marketplace_categories',
  'marketplace_description',
  'brand_primary',
  'brand_primary_soft',
  'brand_accent',
  'brand_accent_soft',
  'brand_background'
].join(',')

const MARKETPLACE_SERVICE_SELECT = [
  'id',
  'name',
  'description',
  'price',
  'default_duration',
  'category',
  'subcategory',
  'pet_type',
  'pricing_model'
].join(',')

function normalizeSlug(value) {
  return value?.toString().trim().toLowerCase() || ''
}

function normalizeString(value) {
  if (value === undefined || value === null) return null
  const trimmed = value.toString().trim()
  return trimmed ? trimmed : null
}

function normalizeEmail(value) {
  const trimmed = normalizeString(value)
  return trimmed ? trimmed.toLowerCase() : null
}

function normalizePhone(value) {
  const trimmed = normalizeString(value)
  return trimmed || null
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function normalizeDate(value) {
  const trimmed = normalizeString(value)
  if (!trimmed) return null
  return trimmed.slice(0, 10)
}

function normalizeTime(value) {
  const trimmed = normalizeString(value)
  if (!trimmed) return null
  const [hh, mm] = trimmed.split(':')
  if (!hh || !mm) return trimmed.slice(0, 5)
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

function coerceLimit(value, fallback = 24) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), 60)
}

function coerceOffset(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return 0
  return Math.max(parsed, 0)
}

async function getAuthenticatedUser(req) {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

async function loadMarketplaceAccountBySlug(supabaseAdmin, slug) {
  if (!slug) return null
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select(MARKETPLACE_ACCOUNT_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('marketplace_enabled', true)
    .maybeSingle()
  if (error) {
    console.error('[marketplace] load account error', error)
    return null
  }
  return data
}

router.get('/accounts', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { q, category } = req.query || {}
  const search = normalizeString(q)
  const categoryFilter = normalizeString(category)
  const limit = coerceLimit(req.query?.limit, 24)
  const offset = coerceOffset(req.query?.offset)

  let query = supabaseAdmin
    .from('accounts')
    .select(MARKETPLACE_ACCOUNT_SELECT)
    .eq('is_active', true)
    .eq('marketplace_enabled', true)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (categoryFilter) {
    query = query.contains('marketplace_categories', [categoryFilter])
  }

  if (search) {
    const safe = search.replace(/%/g, '')
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%,marketplace_description.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[marketplace] list accounts error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.get('/accounts/:slug', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const slug = normalizeSlug(req.params.slug)
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const account = await loadMarketplaceAccountBySlug(supabaseAdmin, slug)
  if (!account) return res.status(404).json({ error: 'Not found' })

  res.json({ account })
})

router.get('/accounts/:slug/services', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const slug = normalizeSlug(req.params.slug)
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const account = await loadMarketplaceAccountBySlug(supabaseAdmin, slug)
  if (!account) return res.status(404).json({ error: 'Not found' })

  const { data, error } = await supabaseAdmin
    .from('services')
    .select(MARKETPLACE_SERVICE_SELECT)
    .eq('account_id', account.id)
    .neq('active', false)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[marketplace] list services error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.post('/booking-requests', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at)
  const requirePhoneVerification =
    process.env.MARKETPLACE_REQUIRE_PHONE_VERIFICATION === 'true'
  const phoneVerified =
    Boolean(user.phone_confirmed_at) ||
    user.user_metadata?.phone_verified === true ||
    user.user_metadata?.phone_verified === 'true'

  if (!emailConfirmed) {
    return res.status(403).json({ error: 'email_verification_required' })
  }
  if (requirePhoneVerification && !phoneVerified) {
    return res.status(403).json({ error: 'phone_verification_required' })
  }

  const payload = req.body || {}
  const accountSlug = normalizeSlug(payload.account_slug || payload.accountSlug)
  if (!accountSlug) return res.status(400).json({ error: 'account_slug_required' })

  const account = await loadMarketplaceAccountBySlug(supabaseAdmin, accountSlug)
  if (!account) return res.status(404).json({ error: 'account_not_found' })

  const appointmentDate = normalizeDate(payload.appointment_date || payload.date)
  const appointmentTime = normalizeTime(payload.appointment_time || payload.time)
  if (!appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'missing_datetime' })
  }

  const serviceIds = Array.isArray(payload.service_ids)
    ? payload.service_ids.filter(Boolean)
    : payload.service_id
      ? [payload.service_id]
      : []

  if (!serviceIds.length) {
    return res.status(400).json({ error: 'service_required' })
  }

  const { data: services, error: servicesError } = await supabaseAdmin
    .from('services')
    .select('id')
    .eq('account_id', account.id)
    .in('id', serviceIds)
    .neq('active', false)

  if (servicesError) {
    console.error('[marketplace] validate services error', servicesError)
    return res.status(500).json({ error: servicesError.message })
  }

  if ((services || []).length !== serviceIds.length) {
    return res.status(400).json({ error: 'invalid_service' })
  }

  const customerPayload = sanitizeBody(payload.customer || {})
  const customerName =
    normalizeString(customerPayload.name) ||
    normalizeString(user.user_metadata?.display_name) ||
    (user.email ? user.email.split('@')[0] : null)
  const customerEmail = normalizeEmail(customerPayload.email || user.email)
  const customerPhone = normalizePhone(
    customerPayload.phone || user.phone || user.user_metadata?.phone || null
  )
  const customerAddress = normalizeString(customerPayload.address)
  const customerNif = normalizeString(customerPayload.nif)

  if (!customerName || !customerEmail || !customerPhone) {
    return res.status(400).json({ error: 'customer_required' })
  }

  let customer = null
  const matchFilters = []
  if (user.id) matchFilters.push(`user_id.eq.${user.id}`)
  if (customerEmail) matchFilters.push(`email.eq.${customerEmail}`)
  if (customerPhone) matchFilters.push(`phone.eq.${customerPhone}`)

  if (matchFilters.length) {
    const { data: existingCustomers, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, user_id, name, phone, email')
      .eq('account_id', account.id)
      .or(matchFilters.join(','))
      .order('created_at', { ascending: true })

    if (customerError) {
      console.error('[marketplace] find customer error', customerError)
    } else if (Array.isArray(existingCustomers) && existingCustomers.length > 0) {
      customer =
        existingCustomers.find((item) => item.user_id === user.id) ||
        existingCustomers.find((item) => !item.user_id) ||
        null
    }
  }

  if (customer) {
    const updates = {}
    if (!customer.user_id && user.id) updates.user_id = user.id
    if (!customer.name && customerName) updates.name = customerName
    if (!customer.email && customerEmail) updates.email = customerEmail
    if (!customer.phone && customerPhone) updates.phone = customerPhone
    if (customerAddress) updates.address = customerAddress
    if (customerNif) updates.nif = customerNif

    if (Object.keys(updates).length) {
      const { data: updatedCustomer, error: updateError } = await supabaseAdmin
        .from('customers')
        .update(updates)
        .eq('id', customer.id)
        .select()
        .maybeSingle()
      if (updateError) {
        console.error('[marketplace] update customer error', updateError)
      } else if (updatedCustomer) {
        customer = updatedCustomer
      }
    }
  }

  if (!customer) {
    const { data: newCustomer, error: newCustomerError } = await supabaseAdmin
      .from('customers')
      .insert({
        account_id: account.id,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        address: customerAddress,
        nif: customerNif,
        user_id: user.id
      })
      .select()
      .single()

    if (newCustomerError) {
      console.error('[marketplace] create customer error', newCustomerError)
      return res.status(500).json({ error: newCustomerError.message })
    }

    customer = newCustomer
  }

  const petPayload = sanitizeBody(payload.pet || {})
  const petName = normalizeString(petPayload.name)
  const petBreed = normalizeString(petPayload.breed)
  const petWeight = normalizeNumber(petPayload.weight)

  if (!petName) return res.status(400).json({ error: 'pet_required' })

  let pet = null
  const { data: existingPet, error: petError } = await supabaseAdmin
    .from('pets')
    .select('id, name')
    .eq('account_id', account.id)
    .eq('customer_id', customer.id)
    .eq('name', petName)
    .maybeSingle()

  if (petError) {
    console.error('[marketplace] find pet error', petError)
  } else if (existingPet) {
    pet = existingPet
  }

  if (!pet) {
    const { data: newPet, error: newPetError } = await supabaseAdmin
      .from('pets')
      .insert({
        account_id: account.id,
        customer_id: customer.id,
        name: petName,
        breed: petBreed,
        weight: petWeight
      })
      .select()
      .single()

    if (newPetError) {
      console.error('[marketplace] create pet error', newPetError)
      return res.status(500).json({ error: newPetError.message })
    }
    pet = newPet
  }

  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from('appointments')
    .insert({
      account_id: account.id,
      customer_id: customer.id,
      pet_id: pet.id,
      service_id: serviceIds[0],
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      notes: normalizeString(payload.notes) || null,
      status: 'pending',
      payment_status: 'unpaid',
      source: 'marketplace'
    })
    .select()
    .single()

  if (appointmentError) {
    console.error('[marketplace] create appointment error', appointmentError)
    return res.status(500).json({ error: appointmentError.message })
  }

  const appointmentServices = serviceIds.map((serviceId) => ({
    appointment_id: appointment.id,
    service_id: serviceId,
    pet_id: pet.id
  }))

  if (appointmentServices.length) {
    const { error: appointmentServiceError } = await supabaseAdmin
      .from('appointment_services')
      .insert(appointmentServices)
    if (appointmentServiceError) {
      console.error('[marketplace] create appointment services error', appointmentServiceError)
    }
  }

  res.status(201).json({
    data: {
      appointment,
      customer_id: customer.id,
      pet_id: pet.id
    }
  })
})

export default router
