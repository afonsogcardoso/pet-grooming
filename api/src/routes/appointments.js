import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { formatCustomerAddress, formatCustomerName, mapAppointmentForApi } from '../utils/customer.js'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  sendPushNotifications,
  shouldSendNotification
} from '../utils/notifications.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const APPOINTMENT_CONFIRM_SELECT = `
  id,
  appointment_date,
  appointment_time,
  duration,
  notes,
  status,
  payment_status,
  reminder_offsets,
  account_id,
  public_token,
  customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 ),
  appointment_services (
    id,
    service_id,
    pet_id,
    services ( id, name, price, display_order ),
    pets ( id, name, breed, photo_url, weight )
  )
`
const APPOINTMENT_DETAIL_SELECT = `
  id,
  appointment_date,
  appointment_time,
  duration,
  notes,
  payment_status,
  status,
  reminder_offsets,
  before_photo_url,
  after_photo_url,
  public_token,
  confirmation_opened_at,
  whatsapp_sent_at,
  customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 ),
  appointment_services (
    id,
    service_id,
    pet_id,
    price_tier_id,
    price_tier_label,
    price_tier_price,
    services ( id, name, price, display_order ),
    pets ( id, name, breed, weight ),
    appointment_service_addons ( id, service_addon_id, name, price )
  )
`
const PET_PHOTO_BUCKET = 'pets'
const REMINDER_WINDOW_MINUTES = 10
const REMINDER_MAX_OFFSET_MINUTES = 1440
const REMINDER_EXCLUDED_STATUSES = new Set(['cancelled', 'completed', 'in_progress'])
const DEFAULT_REMINDER_OFFSETS = [30]

function formatAppointmentDateTime(appointment) {
  if (!appointment) return ''
  const date = appointment.appointment_date || appointment.appointmentDate
  const time = appointment.appointment_time || appointment.appointmentTime
  return [date, time].filter(Boolean).join(' ')
}

function normalizeReminderOffsets(value, fallback = DEFAULT_REMINDER_OFFSETS) {
  if (!Array.isArray(value)) return fallback
  const normalized = value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.round(entry))
    .filter((entry) => entry > 0 && entry <= REMINDER_MAX_OFFSET_MINUTES)
  const unique = Array.from(new Set(normalized)).sort((a, b) => a - b)
  return unique.length > 0 ? unique.slice(0, 2) : fallback
}

function formatLocalDate(value) {
  if (!value) return null
  return value.toLocaleDateString('sv-SE')
}

function normalizeTimeString(value) {
  if (!value) return null
  const raw = value.toString().trim()
  if (!raw) return null
  const parts = raw.split(':').map((part) => part.trim())
  if (parts.length < 2) return null
  const [hours, minutes, seconds] = parts
  const safeHours = hours?.padStart(2, '0')
  const safeMinutes = minutes?.padStart(2, '0')
  const safeSeconds = (seconds || '00').padStart(2, '0')
  return `${safeHours}:${safeMinutes}:${safeSeconds}`
}

function parseAppointmentDateTime(appointment) {
  if (!appointment?.appointment_date || !appointment?.appointment_time) return null
  const time = normalizeTimeString(appointment.appointment_time)
  if (!time) return null
  const dateTime = new Date(`${appointment.appointment_date}T${time}`)
  if (Number.isNaN(dateTime.getTime())) return null
  return dateTime
}

function formatOffsetLabel(offsetMinutes) {
  if (!Number.isFinite(offsetMinutes)) return ''
  if (offsetMinutes % 1440 === 0) {
    const days = offsetMinutes / 1440
    return `${days} dia${days === 1 ? '' : 's'}`
  }
  if (offsetMinutes % 60 === 0) {
    const hours = offsetMinutes / 60
    return `${hours} h`
  }
  return `${offsetMinutes} min`
}

function normalizeServiceSelections(rawSelections) {
  if (!Array.isArray(rawSelections)) return []
  return rawSelections
    .map((selection) => ({
      service_id: selection?.service_id || null,
      pet_id: selection?.pet_id || null,
      price_tier_id: selection?.price_tier_id || selection?.tier_id || null,
      price_tier_label: selection?.price_tier_label || null,
      price_tier_price: selection?.price_tier_price ?? null,
      addon_ids: Array.isArray(selection?.addon_ids)
        ? selection.addon_ids.filter(Boolean)
        : Array.isArray(selection?.addons)
          ? selection.addons.map((addon) => addon?.id).filter(Boolean)
          : null,
      has_tier_field:
        Object.prototype.hasOwnProperty.call(selection || {}, 'price_tier_id') ||
        Object.prototype.hasOwnProperty.call(selection || {}, 'tier_id') ||
        Object.prototype.hasOwnProperty.call(selection || {}, 'price_tier_label') ||
        Object.prototype.hasOwnProperty.call(selection || {}, 'price_tier_price'),
      has_addon_field:
        Object.prototype.hasOwnProperty.call(selection || {}, 'addon_ids') ||
        Object.prototype.hasOwnProperty.call(selection || {}, 'addons')
    }))
    .filter((selection) => Boolean(selection.service_id))
}

async function applyServiceSelections({ supabase, appointmentId, selections }) {
  const normalizedSelections = normalizeServiceSelections(selections)
  if (normalizedSelections.length === 0) return

  const { data: appointmentServices, error: appointmentServicesError } = await supabase
    .from('appointment_services')
    .select('id, service_id, pet_id')
    .eq('appointment_id', appointmentId)

  if (appointmentServicesError) {
    console.error('[api] load appointment services error', appointmentServicesError)
    return
  }

  const selectionBuckets = new Map()
  ;(appointmentServices || []).forEach((row) => {
    const key = `${row.service_id || ''}:${row.pet_id || ''}`
    const bucket = selectionBuckets.get(key) || []
    bucket.push(row.id)
    selectionBuckets.set(key, bucket)
  })

  const fallbackBuckets = new Map()
  ;(appointmentServices || []).forEach((row) => {
    const bucket = fallbackBuckets.get(row.service_id) || []
    bucket.push(row.id)
    fallbackBuckets.set(row.service_id, bucket)
  })

  for (const selection of normalizedSelections) {
    const key = `${selection.service_id || ''}:${selection.pet_id || ''}`
    const keyBucket = selectionBuckets.get(key) || []
    let appointmentServiceId = keyBucket.shift()
    if (keyBucket.length > 0) {
      selectionBuckets.set(key, keyBucket)
    }

    if (!appointmentServiceId && selection.service_id) {
      const fallbackBucket = fallbackBuckets.get(selection.service_id) || []
      appointmentServiceId = fallbackBucket.shift()
      if (fallbackBucket.length > 0) {
        fallbackBuckets.set(selection.service_id, fallbackBucket)
      }
    }
    if (!appointmentServiceId) continue

    if (selection.has_tier_field) {
      let tierPayload = {
        price_tier_id: null,
        price_tier_label: null,
        price_tier_price: null
      }

      if (selection.price_tier_id) {
        const { data: tierData, error: tierError } = await supabase
          .from('service_price_tiers')
          .select('id, label, price, service_id')
          .eq('id', selection.price_tier_id)
          .maybeSingle()

        if (tierError) {
          console.error('[api] load price tier error', tierError)
        } else if (tierData && tierData.service_id === selection.service_id) {
          tierPayload = {
            price_tier_id: tierData.id,
            price_tier_label: tierData.label,
            price_tier_price: tierData.price
          }
        }
      } else if (selection.price_tier_label || selection.price_tier_price != null) {
        tierPayload = {
          price_tier_id: null,
          price_tier_label: selection.price_tier_label,
          price_tier_price: selection.price_tier_price
        }
      }

      await supabase
        .from('appointment_services')
        .update(tierPayload)
        .eq('id', appointmentServiceId)
    }

    if (selection.has_addon_field) {
      await supabase
        .from('appointment_service_addons')
        .delete()
        .eq('appointment_service_id', appointmentServiceId)

      if (selection.addon_ids && selection.addon_ids.length > 0) {
        const { data: addonsData, error: addonsError } = await supabase
          .from('service_addons')
          .select('id, name, price')
          .in('id', selection.addon_ids)

        if (addonsError) {
          console.error('[api] load addon details error', addonsError)
        } else if (addonsData && addonsData.length > 0) {
          const rows = addonsData.map((addon) => ({
            appointment_service_id: appointmentServiceId,
            service_addon_id: addon.id,
            name: addon.name,
            price: addon.price
          }))
          const { error: insertError } = await supabase
            .from('appointment_service_addons')
            .insert(rows)
          if (insertError) {
            console.error('[api] insert appointment addons error', insertError)
          }
        }
      }
    }
  }
}

function formatIcsDateUtc(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function escapeText(value = '') {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

async function getAppointmentByPublicToken(id, token) {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return { data: null, error: new Error('Service client unavailable') }

  return supabase
    .from('appointments')
    .select(APPOINTMENT_CONFIRM_SELECT)
    .eq('id', id)
    .eq('public_token', token)
    .maybeSingle()
}

router.get('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { date_from: dateFrom, date_to: dateTo, limit: limitParam, status, offset: offsetParam } = req.query
  const limit = Math.min(Math.max(Number(limitParam) || 50, 1), 500)
  const offset = Math.max(Number(offsetParam) || 0, 0)
  const start = offset
  const end = offset + limit - 1

  let query = supabase
    .from('appointments')
    .select(
      `
      id,
      appointment_date,
      appointment_time,
      duration,
      notes,
      payment_status,
      status,
      reminder_offsets,
      before_photo_url,
      after_photo_url,
      public_token,
      confirmation_opened_at,
      whatsapp_sent_at,
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 ),
      appointment_services (
        id,
        service_id,
        pet_id,
        price_tier_id,
        price_tier_label,
        price_tier_price,
        services ( id, name, price, display_order ),
        pets ( id, name, breed, weight ),
        appointment_service_addons ( id, service_addon_id, name, price )
      )
    `
    )
    .order('appointment_date', { ascending: true })
    .order('appointment_time', { ascending: true })
    .range(start, end)

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  if (dateFrom) {
    query = query.gte('appointment_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('appointment_date', dateTo)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('[api] appointments error', error)
    return res.status(500).json({ error: error.message })
  }

  const nextOffset = data.length === limit ? offset + limit : null

  res.json({ data: (data || []).map(mapAppointmentForApi), meta: { nextOffset } })
})

router.post('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const supabaseAdmin = getSupabaseServiceRoleClient() || supabase
  const payload = { ...(req.body || {}) }
  const serviceSelections = payload.service_selections
  const normalizedSelections = normalizeServiceSelections(serviceSelections)
  delete payload.service_ids
  delete payload.service_selections

  if (accountId) {
    payload.account_id = accountId
  }

  if (!Array.isArray(serviceSelections) || normalizedSelections.length === 0) {
    return res.status(400).json({ error: 'service_selections_required' })
  }
  if (normalizedSelections.some((selection) => !selection.pet_id)) {
    return res.status(400).json({ error: 'pet_required' })
  }

  const { data: appointment, error } = await supabase.from('appointments').insert(payload).select().single()

  if (error) {
    console.error('[api] create appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  // Insert appointment services if provided
  if (appointment) {
    const appointmentServices = normalizedSelections.map((selection) => ({
      appointment_id: appointment.id,
      service_id: selection.service_id,
      pet_id: selection.pet_id || null
    }))

    if (appointmentServices.length === 0) {
      return res.status(400).json({ error: 'service_selections_required' })
    }

    const { error: servicesError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices)

    if (servicesError) {
      console.error('[api] create appointment services error', servicesError)
      return res.status(500).json({ error: servicesError.message })
    }

    await applyServiceSelections({
      supabase,
      appointmentId: appointment.id,
      selections: serviceSelections
    })

    if (appointment.customer_id) {
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('id, user_id, first_name, last_name')
        .eq('id', appointment.customer_id)
        .maybeSingle()
      if (customer?.user_id) {
        const dateTime = formatAppointmentDateTime(appointment)
        sendPushNotifications({
          supabaseAdmin,
          userIds: [customer.user_id],
          accountId: appointment.account_id,
          type: 'appointments.created',
          title: 'Marcacao criada',
          body: dateTime ? `A tua marcacao foi criada para ${dateTime}.` : 'A tua marcacao foi criada.',
          data: { appointmentId: appointment.id }
        }).catch((error) => console.error('[api] push notification error', error))
      }
    }
  }

  let responseAppointment = appointment
  if (appointment?.id) {
    const { data: refreshed, error: refreshError } = await supabase
      .from('appointments')
      .select(APPOINTMENT_DETAIL_SELECT)
      .eq('id', appointment.id)
      .maybeSingle()
    if (refreshError) {
      console.error('[api] reload appointment error', refreshError)
    } else if (refreshed) {
      responseAppointment = refreshed
    }
  }

  res.status(201).json({ data: mapAppointmentForApi(responseAppointment) })
})

// Public: fetch appointment details for confirmation
router.get('/confirm', async (req, res) => {
  const { id, token } = req.query || {}

  if (!id || !token) {
    return res.status(400).json({ error: 'missing_parameters' })
  }

  const { data: appointment, error } = await getAppointmentByPublicToken(id, token)
  if (error || !appointment) {
    return res.status(404).json({ error: 'not_found' })
  }

  return res.json({ appointment: mapAppointmentForApi(appointment) })
})

// Get single appointment
router.get('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params

  let query = supabase
    .from('appointments')
    .select(APPOINTMENT_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[api] get appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  if (!data) {
    return res.status(404).json({ error: 'Not found' })
  }

  res.json({ data: mapAppointmentForApi(data) })
})

router.patch('/:id/status', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const supabaseAdmin = getSupabaseServiceRoleClient() || supabase
  const { id } = req.params
  const { status } = req.body || {}

  if (!status) {
    return res.status(400).json({ error: 'Missing status' })
  }

  let query = supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select(
      `
      id,
      appointment_date,
      appointment_time,
      duration,
      notes,
      payment_status,
      status,
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url, weight )
    `
    )
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[api] update appointment status error', error)
    return res.status(500).json({ error: error.message })
  }

  const updatedAppointment = Array.isArray(data) ? data[0] : data
  const customerId = updatedAppointment?.customers?.id
  if (
    customerId &&
    (status === 'confirmed' || status === 'cancelled')
  ) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, user_id, first_name, last_name')
      .eq('id', customerId)
      .maybeSingle()
    if (customer?.user_id) {
      const dateTime = formatAppointmentDateTime(updatedAppointment)
      const title = status === 'confirmed' ? 'Marcacao confirmada' : 'Marcacao cancelada'
      const body = status === 'confirmed'
        ? dateTime
          ? `A tua marcacao de ${dateTime} foi confirmada.`
          : 'A tua marcacao foi confirmada.'
        : dateTime
          ? `A tua marcacao de ${dateTime} foi cancelada.`
          : 'A tua marcacao foi cancelada.'
      sendPushNotifications({
        supabaseAdmin,
        userIds: [customer.user_id],
        accountId: accountId || null,
        type: status === 'confirmed' ? 'appointments.confirmed' : 'appointments.cancelled',
        title,
        body,
        data: { appointmentId: id, status }
      }).catch((notifyError) => console.error('[api] push notification error', notifyError))
    }
  }

  res.json({ data: Array.isArray(data) ? data.map(mapAppointmentForApi) : mapAppointmentForApi(data) })
})

router.patch('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const payload = req.body || {}
  const serviceSelections = payload.service_selections
  const normalizedSelections = normalizeServiceSelections(serviceSelections)
  delete payload.service_selections
  delete payload.service_ids

  if (serviceSelections !== undefined) {
    if (normalizedSelections.length === 0) {
      return res.status(400).json({ error: 'service_selections_required' })
    }
    if (normalizedSelections.some((selection) => !selection.pet_id)) {
      return res.status(400).json({ error: 'pet_required' })
    }
  }

  const allowed = [
    'status',
    'payment_status',
    'notes',
    'duration',
    'amount',
    'appointment_date',
    'appointment_time',
    'customer_id',
    'reminder_offsets',
  ]

  const updates = {}
  allowed.forEach((key) => {
    if (payload[key] !== undefined) updates[key] = payload[key]
  })

  const shouldUpdateAppointment = Object.keys(updates).length > 0
  const shouldUpdateServices = normalizedSelections.length > 0

  if (!shouldUpdateAppointment && !shouldUpdateServices) {
    return res.status(400).json({ error: 'No fields to update' })
  }

  let appointment = null
  if (shouldUpdateAppointment) {
    let query = supabase.from('appointments').update(updates).eq('id', id)
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error } = await query.select(
      `
      id,
      appointment_date,
      appointment_time,
      duration,
      notes,
      payment_status,
      status,
      reminder_offsets,
  customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 )
    `
    ).single()

    if (error) {
      console.error('[api] update appointment error', error)
      return res.status(500).json({ error: error.message })
    }

    appointment = data
  } else {
    let authQuery = supabase.from('appointments').select('id').eq('id', id).maybeSingle()
    if (accountId) {
      authQuery = authQuery.eq('account_id', accountId)
    }
    const { data: existing, error: loadError } = await authQuery
    if (loadError) {
      console.error('[api] load appointment error', loadError)
      return res.status(500).json({ error: loadError.message })
    }
    if (!existing) {
      return res.status(404).json({ error: 'Not found' })
    }
  }

  // Update appointment services if provided
  if (shouldUpdateServices) {
    await supabase
      .from('appointment_services')
      .delete()
      .eq('appointment_id', id)

    const appointmentServices = normalizedSelections.map((selection) => ({
      appointment_id: id,
      service_id: selection.service_id,
      pet_id: selection.pet_id || null
    }))
    const { error: servicesError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices)

    if (servicesError) {
      console.error('[api] update appointment services error', servicesError)
      return res.status(500).json({ error: servicesError.message })
    }

    await applyServiceSelections({
      supabase,
      appointmentId: id,
      selections: serviceSelections
    })
  }

  let responseAppointment = appointment
  let refreshQuery = supabase
    .from('appointments')
    .select(APPOINTMENT_DETAIL_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (accountId) {
    refreshQuery = refreshQuery.eq('account_id', accountId)
  }
  const { data: refreshed, error: refreshError } = await refreshQuery
  if (refreshError) {
    console.error('[api] reload appointment error', refreshError)
  } else if (refreshed) {
    responseAppointment = refreshed
  }

  if (!responseAppointment) {
    return res.status(404).json({ error: 'Not found' })
  }

  res.json({ data: mapAppointmentForApi(responseAppointment) })
})

router.delete('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params

  let query = supabase.from('appointments').delete().eq('id', id)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { error } = await query

  if (error) {
    console.error('[api] delete appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(204).send()
})

// Public: mark confirmation opened
router.post('/confirm-open', async (req, res) => {
  const { id, token } = req.body || {}

  if (!id || !token) {
    return res.status(400).json({ ok: false, error: 'missing_parameters' })
  }

  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return res.status(500).json({ ok: false, error: 'service_unavailable' })

  const { error } = await supabase
    .from('appointments')
    .update({ confirmation_opened_at: new Date().toISOString() })
    .eq('id', id)
    .eq('public_token', token)
    .is('confirmation_opened_at', null)

  if (error) {
    console.error('[api] confirm-open update failed', error)
  }

  res.json({ ok: true })
})

// Public: generate ICS for appointment
router.get('/ics', async (req, res) => {
  const { id, token } = req.query || {}

  if (!id || !token) {
    return res.status(400).json({ error: 'missing_parameters' })
  }

  const { data: appointment, error } = await getAppointmentByPublicToken(id, token)
  if (error || !appointment) {
    return res.status(404).json({ error: 'not_found' })
  }

  const startDate = new Date(
    `${appointment.appointment_date}T${(appointment.appointment_time || '00:00').slice(0, 5)}:00`
  )
  const endDate = new Date(startDate)
  endDate.setMinutes(endDate.getMinutes() + (appointment.duration || 60))

  const customerName = formatCustomerName(appointment.customers)
  const titleParts = [appointment.services?.name, appointment.pets?.name || customerName || ''].filter(Boolean)
  const summary = titleParts.join(' • ') || 'Appointment'

  const customerAddress = formatCustomerAddress(appointment.customers)
  const descriptionParts = [appointment.notes, customerAddress].filter(Boolean)
  const description = escapeText(descriptionParts.join('\n'))

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'PRODID:-//Pet Grooming//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@pet-grooming`,
    `DTSTAMP:${formatIcsDateUtc(new Date())}`,
    `DTSTART:${formatIcsDateUtc(startDate)}`,
    `DTEND:${formatIcsDateUtc(endDate)}`,
    `SUMMARY:${escapeText(summary)}`,
    description ? `DESCRIPTION:${description}` : null,
    customerAddress ? `LOCATION:${escapeText(customerAddress)}` : null,
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n')

  res
    .status(200)
    .set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="appointment-${appointment.appointment_date}.ics"`
    })
    .send(ics)
})

// Public: upload pet photo (multipart not supported here)
router.post('/pet-photo', upload.single('file'), async (req, res) => {
  const { id, token, pet_id: petId } = req.body || {}
  const file = req.file

  if (!id || !token || !petId || !file) {
    return res.status(400).json({ ok: false, error: 'missing_parameters' })
  }

  const appointmentResult = await getAppointmentByPublicToken(id, token)
  const appointment = appointmentResult.data
  if (!appointment) {
    return res.status(404).json({ ok: false, error: 'not_found' })
  }

  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ ok: false, error: 'file_too_large' })
  }

  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return res.status(500).json({ ok: false, error: 'service_unavailable' })

  const { data: appointmentServices, error: servicesError } = await supabase
    .from('appointment_services')
    .select('pet_id')
    .eq('appointment_id', appointment.id)

  if (servicesError) {
    console.error('[api] pet photo appointment services error', servicesError)
    return res.status(500).json({ ok: false, error: 'load_services_failed' })
  }

  const petAllowed = (appointmentServices || []).some((entry) => entry.pet_id === petId)
  if (!petAllowed) {
    return res.status(403).json({ ok: false, error: 'invalid_pet' })
  }

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const path = `pets/${petId}/${uniqueId}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    console.error('[api] pet photo upload error', uploadError)
    return res.status(500).json({ ok: false, error: 'upload_failed' })
  }

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('pets')
    .createSignedUrl(path, 604800)

  if (signedError) {
    console.error('[api] pet photo signed URL error', signedError)
    return res.status(500).json({ ok: false, error: 'signed_url_failed' })
  }
  const publicUrl = signedUrlData?.signedUrl || null

  if (publicUrl) {
    await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', petId)
  }

  return res.json({ ok: true, url: publicUrl })
})

// Upload before/after photos for appointment
router.post('/:id/photos', upload.single('file'), async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase || !accountId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const { type } = req.body // 'before' or 'after'
  const file = req.file

  if (!file || !type || !['before', 'after'].includes(type)) {
    return res.status(400).json({ error: 'Missing file or invalid type' })
  }

  if (file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File too large (max 5MB)' })
  }

  // Verify appointment belongs to account
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, account_id')
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle()

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' })
  }

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const path = `appointments/${id}/${type}-${uniqueId}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from('appointments')
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    console.error('[api] appointment photo upload error', uploadError)
    return res.status(500).json({ error: 'Upload failed' })
  }

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('appointments')
    .createSignedUrl(path, 604800)

  if (signedError) return res.status(500).json({ error: signedError.message })
  const publicUrl = signedUrlData?.signedUrl || null

  if (publicUrl) {
    const column = type === 'before' ? 'before_photo_url' : 'after_photo_url'
    await supabase
      .from('appointments')
      .update({ [column]: publicUrl })
      .eq('id', id)
      .eq('account_id', accountId)
  }

  return res.json({ url: publicUrl })
})

router.post('/reminders', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const secretToken = bearerToken || req.get('x-cron-secret')

  if (!cronSecret || !secretToken || secretToken !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { data: members, error: membersError } = await supabaseAdmin
    .from('account_members')
    .select('account_id, user_id, status')
    .eq('status', 'active')

  if (membersError) {
    console.error('[appointments] load account members error', membersError)
    return res.status(500).json({ error: membersError.message })
  }

  const membersByAccount = new Map()
  const userIds = new Set()
  ;(members || []).forEach((row) => {
    if (!row?.account_id || !row?.user_id) return
    const bucket = membersByAccount.get(row.account_id) || new Set()
    bucket.add(row.user_id)
    membersByAccount.set(row.account_id, bucket)
    userIds.add(row.user_id)
  })

  if (!userIds.size) {
    return res.json({ ok: true, processed: 0, reminders: 0, sent: 0, failed: 0, skipped: 0 })
  }

  const { data: preferenceRows, error: preferencesError } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id, preferences')
    .in('user_id', Array.from(userIds))

  if (preferencesError) {
    console.error('[appointments] load notification preferences error', preferencesError)
    return res.status(500).json({ error: preferencesError.message })
  }

  const defaultPreferences = normalizeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES)
  const preferencesByUser = new Map()
  userIds.forEach((userId) => {
    preferencesByUser.set(userId, defaultPreferences)
  })

  ;(preferenceRows || []).forEach((row) => {
    if (!row?.user_id) return
    preferencesByUser.set(row.user_id, normalizeNotificationPreferences(row.preferences))
  })

  const offsetsByUser = new Map()
  const reminderEnabledUsers = new Set()
  preferencesByUser.forEach((preferences, userId) => {
    if (!shouldSendNotification(preferences, 'appointments.reminder')) return
    const offsets = normalizeReminderOffsets(preferences?.push?.appointments?.reminder_offsets)
    if (!offsets.length) return
    offsetsByUser.set(userId, offsets)
    reminderEnabledUsers.add(userId)
  })

  if (!reminderEnabledUsers.size) {
    return res.json({ ok: true, processed: 0, reminders: 0, sent: 0, failed: 0, skipped: 0 })
  }

  const now = new Date()
  const windowMinutes = Math.max(1, Number(process.env.REMINDER_WINDOW_MINUTES) || REMINDER_WINDOW_MINUTES)
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000)
  const windowEnd = new Date(now.getTime() + windowMinutes * 60 * 1000)
  const minOffset = 1
  const maxOffset = REMINDER_MAX_OFFSET_MINUTES
  const rangeStart = new Date(windowStart.getTime() + minOffset * 60 * 1000)
  const rangeEnd = new Date(windowEnd.getTime() + maxOffset * 60 * 1000)
  const startDate = formatLocalDate(rangeStart)
  const endDate = formatLocalDate(rangeEnd)

  if (!startDate || !endDate) {
    return res.status(500).json({ error: 'invalid_time_range' })
  }

  const { data: appointments, error: appointmentsError } = await supabaseAdmin
    .from('appointments')
    .select('id, account_id, appointment_date, appointment_time, status, reminder_offsets')
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)

  if (appointmentsError) {
    console.error('[appointments] load reminders appointments error', appointmentsError)
    return res.status(500).json({ error: appointmentsError.message })
  }

  const dedupeStart = new Date(now.getTime() - (maxOffset + windowMinutes) * 60 * 1000)
  const { data: existingNotifications, error: notificationsError } = await supabaseAdmin
    .from('notifications')
    .select('user_id, payload')
    .eq('type', 'appointments.reminder')
    .in('user_id', Array.from(reminderEnabledUsers))
    .gte('created_at', dedupeStart.toISOString())

  if (notificationsError) {
    console.error('[appointments] load reminders notifications error', notificationsError)
  }

  const alreadySent = new Set()
  ;(existingNotifications || []).forEach((row) => {
    const payload = row?.payload || {}
    const appointmentId = payload.appointmentId || payload.appointment_id
    const offsetMinutes =
      payload.reminderOffsetMinutes || payload.offsetMinutes || payload.offset_minutes
    if (!row?.user_id || !appointmentId || !offsetMinutes) return
    alreadySent.add(`${row.user_id}:${appointmentId}:${offsetMinutes}`)
  })

  const queuedByReminder = new Map()
  const windowStartMs = windowStart.getTime()
  const windowEndMs = windowEnd.getTime()

  ;(appointments || []).forEach((appointment) => {
    if (!appointment?.account_id) return
    if (appointment.status && REMINDER_EXCLUDED_STATUSES.has(appointment.status)) return
    const appointmentDateTime = parseAppointmentDateTime(appointment)
    if (!appointmentDateTime) return
    const accountMembers = membersByAccount.get(appointment.account_id)
    if (!accountMembers || accountMembers.size === 0) return
    const appointmentOffsets = normalizeReminderOffsets(appointment.reminder_offsets, [])

    accountMembers.forEach((userId) => {
      if (!reminderEnabledUsers.has(userId)) return
      const offsets = appointmentOffsets.length > 0 ? appointmentOffsets : offsetsByUser.get(userId)
      if (!offsets || offsets.length === 0) return
      offsets.forEach((offset) => {
        const reminderTimeMs = appointmentDateTime.getTime() - offset * 60 * 1000
        if (reminderTimeMs < windowStartMs || reminderTimeMs > windowEndMs) return
        const key = `${userId}:${appointment.id}:${offset}`
        if (alreadySent.has(key)) return
        alreadySent.add(key)
        const reminderKey = `${appointment.id}:${offset}`
        const entry = queuedByReminder.get(reminderKey) || {
          appointment,
          offset,
          userIds: new Set()
        }
        entry.userIds.add(userId)
        queuedByReminder.set(reminderKey, entry)
      })
    })
  })

  const summary = { processed: appointments?.length || 0, reminders: 0, sent: 0, failed: 0, skipped: 0 }

  for (const entry of queuedByReminder.values()) {
    const userIds = Array.from(entry.userIds || [])
    if (!userIds.length) continue
    summary.reminders += userIds.length
    const timeLabel = entry.appointment?.appointment_time
      ? entry.appointment.appointment_time.toString().slice(0, 5)
      : ''
    const dateLabel = entry.appointment?.appointment_date || ''
    const dateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(' ')
    const offsetLabel = formatOffsetLabel(entry.offset)
    const body = offsetLabel
      ? `Tens uma marcacao em ${offsetLabel}${dateTimeLabel ? ` (${dateTimeLabel})` : ''}.`
      : `Tens uma marcacao${dateTimeLabel ? ` (${dateTimeLabel})` : ''}.`

    const reminderAt = parseAppointmentDateTime(entry.appointment)
    const payload = {
      appointmentId: entry.appointment?.id,
      reminderOffsetMinutes: entry.offset,
      reminderAt: reminderAt
        ? new Date(reminderAt.getTime() - entry.offset * 60 * 1000).toISOString()
        : null
    }

    const result = await sendPushNotifications({
      supabaseAdmin,
      userIds,
      accountId: entry.appointment?.account_id || null,
      type: 'appointments.reminder',
      title: 'Lembrete de marcacao',
      body,
      data: payload
    })

    summary.sent += result.sent || 0
    summary.failed += result.failed || 0
    summary.skipped += result.skipped || 0
  }

  return res.json({ ok: true, ...summary })
})

// Get shareable appointment with temporary signed URLs
router.get('/:id/share', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return res.status(500).json({ error: 'Service unavailable' })

  const { id } = req.params

  // Buscar appointment com fotos
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      appointment_time,
      status,
      notes,
      before_photo_url,
      after_photo_url,
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number ),
      appointment_services ( 
        service_id,
        services ( id, name, price ),
        pets ( id, name, breed, weight )
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !appointment) {
    return res.status(404).json({ error: 'Appointment not found' })
  }

  // Gerar signed URLs temporárias para as fotos (válidas por 7 dias)
  const signedUrls = {}

  if (appointment.before_photo_url) {
    // Extrair path do URL completo
    const beforePath = appointment.before_photo_url.split('/appointments/')[1]
    if (beforePath) {
      const { data } = await supabase.storage
        .from('appointments')
        .createSignedUrl(`appointments/${beforePath}`, 604800)
      if (data?.signedUrl) signedUrls.beforePhoto = data.signedUrl
    }
  }

  if (appointment.after_photo_url) {
    const afterPath = appointment.after_photo_url.split('/appointments/')[1]
    if (afterPath) {
      const { data } = await supabase.storage
        .from('appointments')
        .createSignedUrl(`appointments/${afterPath}`, 604800)
      if (data?.signedUrl) signedUrls.afterPhoto = data.signedUrl
    }
  }

  return res.json({
    appointment: {
      id: appointment.id,
      date: appointment.appointment_date,
      time: appointment.appointment_time,
      status: appointment.status,
      notes: appointment.notes,
      customer: mapAppointmentForApi({ customers: appointment.customers }).customers,
      pets: (appointment.appointment_services || [])
        .map((entry) => entry.pets)
        .filter(Boolean),
      services: appointment.appointment_services?.map(as => as.services) || [],
      photos: signedUrls
    }
  })
})

export default router
