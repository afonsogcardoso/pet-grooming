import { Router } from 'express'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { getAuthenticatedUser } from '../utils/auth.js'
import { sanitizeBody } from '../utils/payload.js'
import { normalizePhoneParts } from '../utils/phone.js'
import { normalizeSlug } from '../utils/slug.js'
import { mapAppointmentForApi } from '../utils/customer.js'

const router = Router()

const MARKETPLACE_ACCOUNT_SELECT = [
  'id',
  'name',
  'slug',
  'logo_url',
  'portal_image_url',
  'support_email',
  'support_phone',
  'marketplace_region',
  'marketplace_categories',
  'marketplace_description',
  'marketplace_instagram_url',
  'marketplace_facebook_url',
  'marketplace_tiktok_url',
  'marketplace_website_url',
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
  'image_url',
  'price',
  'default_duration',
  'category',
  'subcategory',
  'pet_type',
  'pricing_model'
].join(',')

const CONSUMER_PET_SELECT = [
  'id',
  'name',
  'breed',
  'weight',
  'photo_url'
].join(',')

const MARKETPLACE_APPOINTMENT_SELECT = `
  id,
  appointment_date,
  appointment_time,
  duration,
  notes,
  status,
  payment_status,
  amount,
  before_photo_url,
  after_photo_url,
  account:accounts ( id, name, slug, logo_url, support_email, support_phone ),
  customers!inner ( id, first_name, last_name, phone, email, address ),
  pets ( id, name, breed, photo_url, weight ),
  services ( id, name, price ),
  appointment_services (
    id,
    service_id,
    services ( id, name, price ),
    pets ( id, name )
  )
`

function normalizeString(value) {
  if (value === undefined || value === null) return null
  const trimmed = value.toString().trim()
  return trimmed ? trimmed : null
}

function normalizeEmail(value) {
  const trimmed = normalizeString(value)
  return trimmed ? trimmed.toLowerCase() : null
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
    query = query.or(
      `name.ilike.%${safe}%,slug.ilike.%${safe}%,marketplace_description.ilike.%${safe}%,marketplace_region.ilike.%${safe}%`
    )
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

router.get('/pets', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { data, error } = await supabaseAdmin
    .from('consumer_pets')
    .select(CONSUMER_PET_SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[marketplace] list consumer pets error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.post('/pets', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const payload = sanitizeBody(req.body || {})
  const name = normalizeString(payload.name)
  const breed = normalizeString(payload.breed)
  const weight = normalizeNumber(payload.weight)
  const photoUrl = normalizeString(payload.photo_url || payload.photoUrl)

  if (!name) return res.status(400).json({ error: 'pet_required' })

  const { data, error } = await supabaseAdmin
    .from('consumer_pets')
    .insert({
      user_id: user.id,
      name,
      breed,
      weight,
      photo_url: photoUrl
    })
    .select(CONSUMER_PET_SELECT)
    .single()

  if (error) {
    console.error('[marketplace] create consumer pet error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

router.patch('/pets/:id', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = normalizeString(req.params.id)
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const payload = sanitizeBody(req.body || {})
  const updates = {}
  if (payload.name !== undefined) updates.name = normalizeString(payload.name)
  if (payload.breed !== undefined) updates.breed = normalizeString(payload.breed)
  if (payload.weight !== undefined) updates.weight = normalizeNumber(payload.weight)
  if (payload.photo_url !== undefined || payload.photoUrl !== undefined) {
    updates.photo_url = normalizeString(payload.photo_url || payload.photoUrl)
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'missing_fields' })
  }
  if (updates.name === null) {
    return res.status(400).json({ error: 'pet_required' })
  }

  const { data, error } = await supabaseAdmin
    .from('consumer_pets')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(CONSUMER_PET_SELECT)
    .maybeSingle()

  if (error) {
    console.error('[marketplace] update consumer pet error', error)
    return res.status(500).json({ error: error.message })
  }
  if (!data) return res.status(404).json({ error: 'not_found' })

  res.json({ data })
})

router.delete('/pets/:id', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = normalizeString(req.params.id)
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const { error } = await supabaseAdmin
    .from('consumer_pets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[marketplace] delete consumer pet error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(204).send()
})

router.get('/my-appointments', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const limit = coerceLimit(req.query?.limit, 24)
  const offset = coerceOffset(req.query?.offset)
  const statusFilter = normalizeString(req.query?.status)
  const dateFrom = normalizeDate(req.query?.date_from)
  const dateTo = normalizeDate(req.query?.date_to)

  let query = supabaseAdmin
    .from('appointments')
    .select(MARKETPLACE_APPOINTMENT_SELECT)
    .eq('customers.user_id', user.id)
    .order('appointment_date', { ascending: false })
    .order('appointment_time', { ascending: false })
    .range(offset, offset + limit - 1)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }
  if (dateFrom) {
    query = query.gte('appointment_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('appointment_date', dateTo)
  }

  const { data, error } = await query
  if (error) {
    console.error('[marketplace] list my appointments error', error)
    return res.status(500).json({ error: error.message })
  }

  const nextOffset = data && data.length === limit ? offset + limit : null
  const mapped = (data || []).map(mapAppointmentForApi)
  res.json({ data: mapped, meta: { nextOffset } })
})

router.get('/my-appointments/:id', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = normalizeString(req.params.id)
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const { data, error } = await supabaseAdmin
    .from('appointments')
    .select(MARKETPLACE_APPOINTMENT_SELECT)
    .eq('id', id)
    .eq('customers.user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[marketplace] load my appointment error', error)
    return res.status(500).json({ error: error.message })
  }
  if (!data) return res.status(404).json({ error: 'not_found' })

  res.json({ data: mapAppointmentForApi(data) })
})

router.patch('/my-appointments/:id/cancel', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const id = normalizeString(req.params.id)
  if (!id) return res.status(400).json({ error: 'missing_id' })

  const { data: appointment, error: loadError } = await supabaseAdmin
    .from('appointments')
    .select('id, status, customer_id, customers!inner ( user_id )')
    .eq('id', id)
    .eq('customers.user_id', user.id)
    .maybeSingle()

  if (loadError) {
    console.error('[marketplace] cancel load appointment error', loadError)
    return res.status(500).json({ error: loadError.message })
  }
  if (!appointment) return res.status(404).json({ error: 'not_found' })

  if (appointment.status === 'completed') {
    return res.status(400).json({ error: 'cannot_cancel_completed' })
  }
  if (appointment.status === 'in_progress') {
    return res.status(400).json({ error: 'cannot_cancel_in_progress' })
  }
  if (appointment.status === 'cancelled') {
    const { data: cancelledData, error: cancelledError } = await supabaseAdmin
      .from('appointments')
      .select(MARKETPLACE_APPOINTMENT_SELECT)
      .eq('id', id)
      .eq('customers.user_id', user.id)
      .maybeSingle()
    if (cancelledError) {
      console.error('[marketplace] reload cancelled appointment error', cancelledError)
      return res.status(500).json({ error: cancelledError.message })
    }
    return res.json({ data: mapAppointmentForApi(cancelledData) })
  }

  const { error: updateError } = await supabaseAdmin
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('customer_id', appointment.customer_id)

  if (updateError) {
    console.error('[marketplace] cancel appointment error', updateError)
    return res.status(500).json({ error: updateError.message })
  }

  const { data: updated, error: updatedError } = await supabaseAdmin
    .from('appointments')
    .select(MARKETPLACE_APPOINTMENT_SELECT)
    .eq('id', id)
    .eq('customers.user_id', user.id)
    .maybeSingle()

  if (updatedError) {
    console.error('[marketplace] reload cancelled appointment error', updatedError)
    return res.status(500).json({ error: updatedError.message })
  }

  res.json({ data: mapAppointmentForApi(updated) })
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
  const customerFirstName = normalizeString(customerPayload.firstName || customerPayload.first_name)
  const customerLastName = normalizeString(customerPayload.lastName || customerPayload.last_name)
  const customerEmail = normalizeEmail(customerPayload.email || user.email)
  let rawPhone = null
  if (customerPayload.phone) {
    rawPhone = customerPayload.phone
  } else if (user.phone) {
    rawPhone = user.phone
  } else if (user.user_metadata?.phone) {
    rawPhone = user.user_metadata.phone
  }

  let rawCountryCode = null
  if (customerPayload.phoneCountryCode) {
    rawCountryCode = customerPayload.phoneCountryCode
  } else if (user.user_metadata?.phone_country_code) {
    rawCountryCode = user.user_metadata.phone_country_code
  }

  let rawPhoneNumber = null
  if (customerPayload.phoneNumber) {
    rawPhoneNumber = customerPayload.phoneNumber
  } else if (user.user_metadata?.phone_number) {
    rawPhoneNumber = user.user_metadata.phone_number
  }

  const phoneParts = normalizePhoneParts({
    phone: rawPhone,
    phoneCountryCode: rawCountryCode,
    phoneNumber: rawPhoneNumber
  })
  const customerPhone = phoneParts.phone
  const customerPhoneCountryCode = phoneParts.phone_country_code
  const customerPhoneNumber = phoneParts.phone_number
  const customerAddress = normalizeString(customerPayload.address)
  const customerNif = normalizeString(customerPayload.nif)

  if (!customerFirstName || !customerLastName || !customerEmail || !customerPhone) {
    return res.status(400).json({ error: 'customer_required' })
  }

  let customer = null
  const matchFilters = []
  if (user.id) matchFilters.push(`user_id.eq.${user.id}`)
  if (customerEmail) matchFilters.push(`email.eq.${customerEmail}`)
  if (customerPhone) matchFilters.push(`phone.eq.${customerPhone}`)
  if (customerPhoneNumber) matchFilters.push(`phone_number.eq.${customerPhoneNumber}`)

  if (matchFilters.length) {
    const { data: existingCustomers, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('id, user_id, first_name, last_name, phone, phone_country_code, phone_number, email')
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
    if (customer.first_name !== customerFirstName) updates.first_name = customerFirstName
    if (customer.last_name !== customerLastName) updates.last_name = customerLastName
    if (!customer.email && customerEmail) updates.email = customerEmail
    if (!customer.phone && customerPhone) updates.phone = customerPhone
    if (!customer.phone_country_code && customerPhoneCountryCode) {
      updates.phone_country_code = customerPhoneCountryCode
    }
    if (!customer.phone_number && customerPhoneNumber) {
      updates.phone_number = customerPhoneNumber
    }
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
        first_name: customerFirstName,
        last_name: customerLastName,
        email: customerEmail,
        phone: customerPhone,
        phone_country_code: customerPhoneCountryCode,
        phone_number: customerPhoneNumber,
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
  const savePetProfile = payload.save_pet === true || payload.savePet === true
  const rawConsumerPetId = payload.pet_id || payload.petId || payload.consumer_pet_id
  const consumerPetId = normalizeString(rawConsumerPetId)

  let consumerPet = null
  if (consumerPetId) {
    const { data: consumerPetData, error: consumerPetError } = await supabaseAdmin
      .from('consumer_pets')
      .select(CONSUMER_PET_SELECT)
      .eq('id', consumerPetId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (consumerPetError) {
      console.error('[marketplace] load consumer pet error', consumerPetError)
      return res.status(500).json({ error: consumerPetError.message })
    }
    if (!consumerPetData) {
      return res.status(400).json({ error: 'pet_not_found' })
    }
    consumerPet = consumerPetData
  }

  const petName = normalizeString(consumerPet?.name || petPayload.name)
  const petBreed = normalizeString(consumerPet?.breed || petPayload.breed)
  const petWeight = normalizeNumber(
    consumerPet?.weight !== undefined && consumerPet?.weight !== null
      ? consumerPet.weight
      : petPayload.weight
  )

  if (!petName) return res.status(400).json({ error: 'pet_required' })

  let resolvedConsumerPetId = consumerPet?.id || null
  if (!resolvedConsumerPetId && savePetProfile) {
    const { data: newConsumerPet, error: newConsumerPetError } = await supabaseAdmin
      .from('consumer_pets')
      .insert({
        user_id: user.id,
        name: petName,
        breed: petBreed,
        weight: petWeight
      })
      .select(CONSUMER_PET_SELECT)
      .single()

    if (newConsumerPetError) {
      console.error('[marketplace] create consumer pet error', newConsumerPetError)
      return res.status(500).json({ error: newConsumerPetError.message })
    }

    resolvedConsumerPetId = newConsumerPet?.id || null
  }

  let pet = null
  let petQuery = supabaseAdmin
    .from('pets')
    .select('id, name, breed, weight, consumer_pet_id')
    .eq('account_id', account.id)
    .eq('customer_id', customer.id)

  if (resolvedConsumerPetId) {
    petQuery = petQuery.eq('consumer_pet_id', resolvedConsumerPetId)
  } else {
    petQuery = petQuery.eq('name', petName)
  }

  const { data: existingPet, error: petError } = await petQuery.maybeSingle()

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
        weight: petWeight,
        consumer_pet_id: resolvedConsumerPetId
      })
      .select()
      .single()

    if (newPetError) {
      console.error('[marketplace] create pet error', newPetError)
      return res.status(500).json({ error: newPetError.message })
    }
    pet = newPet
  } else {
    const petUpdates = {}
    if (!pet.consumer_pet_id && resolvedConsumerPetId) {
      petUpdates.consumer_pet_id = resolvedConsumerPetId
    }
    if (!pet.breed && petBreed) petUpdates.breed = petBreed
    if (pet.weight === null || pet.weight === undefined) {
      if (petWeight !== null && petWeight !== undefined) {
        petUpdates.weight = petWeight
      }
    }

    if (Object.keys(petUpdates).length) {
      const { data: updatedPet, error: updatePetError } = await supabaseAdmin
        .from('pets')
        .update(petUpdates)
        .eq('id', pet.id)
        .select()
        .maybeSingle()
      if (updatePetError) {
        console.error('[marketplace] update pet error', updatePetError)
      } else if (updatedPet) {
        pet = updatedPet
      }
    }
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
