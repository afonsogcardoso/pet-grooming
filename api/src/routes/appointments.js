import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { formatCustomerName, mapAppointmentForApi } from '../utils/customer.js'
import { sendPushNotifications } from '../utils/notifications.js'

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
  account_id,
  public_token,
  customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address ),
  pets ( id, name, breed, photo_url, weight ),
  services ( id, name )
`
const APPOINTMENT_DETAIL_SELECT = `
  id,
  appointment_date,
  appointment_time,
  duration,
  notes,
  payment_status,
  status,
  before_photo_url,
  after_photo_url,
  public_token,
  confirmation_opened_at,
  whatsapp_sent_at,
  customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address ),
  services ( id, name, price ),
  pets ( id, name, breed, photo_url, weight ),
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

function formatAppointmentDateTime(appointment) {
  if (!appointment) return ''
  const date = appointment.appointment_date || appointment.appointmentDate
  const time = appointment.appointment_time || appointment.appointmentTime
  return [date, time].filter(Boolean).join(' ')
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
      before_photo_url,
      after_photo_url,
      public_token,
      confirmation_opened_at,
      whatsapp_sent_at,
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url, weight ),
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
  const serviceIds = payload.service_ids || (payload.service_id ? [payload.service_id] : [])
  delete payload.service_ids
  delete payload.service_selections

  if (accountId) {
    payload.account_id = accountId
  }

  const { data: appointment, error } = await supabase.from('appointments').insert(payload).select().single()

  if (error) {
    console.error('[api] create appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  // Insert appointment services if provided
  if (appointment) {
    const hasSelections = Array.isArray(serviceSelections) && serviceSelections.length > 0
    const appointmentServices = hasSelections
      ? normalizeServiceSelections(serviceSelections).map((selection) => ({
        appointment_id: appointment.id,
        service_id: selection.service_id,
        pet_id: selection.pet_id || null
      }))
      : serviceIds.map((serviceId) => ({
        appointment_id: appointment.id,
        service_id: serviceId
      }))

    if (appointmentServices.length > 0) {
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .insert(appointmentServices)

      if (servicesError) {
        console.error('[api] create appointment services error', servicesError)
      }
    }

    if (hasSelections) {
      await applyServiceSelections({
        supabase,
        appointmentId: appointment.id,
        selections: serviceSelections
      })
    }

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

  res.status(201).json({ data: mapAppointmentForApi(appointment) })
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
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address ),
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
  const serviceIdsFromPayload = Array.isArray(payload.service_ids)
    ? payload.service_ids
    : (payload.service_id ? [payload.service_id] : null)
  const serviceIdsFromSelections = normalizedSelections.length > 0
    ? Array.from(new Set(normalizedSelections.map((selection) => selection.service_id).filter(Boolean)))
    : null
  const serviceIds = serviceIdsFromPayload ?? serviceIdsFromSelections
  delete payload.service_selections
  delete payload.service_ids

  const allowed = [
    'status',
    'payment_status',
    'notes',
    'duration',
    'amount',
    'appointment_date',
    'appointment_time',
    'customer_id',
    'pet_id',
    'service_id',
  ]

  const updates = {}
  allowed.forEach((key) => {
    if (payload[key] !== undefined) updates[key] = payload[key]
  })

  if (updates.service_id === undefined && Array.isArray(serviceIds)) {
    updates.service_id = serviceIds[0] ?? null
  }

  const shouldUpdateAppointment = Object.keys(updates).length > 0
  const shouldUpdateServices = normalizedSelections.length > 0 || Array.isArray(serviceIds)

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
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url )
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

    if (normalizedSelections.length > 0) {
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
      } else {
        await applyServiceSelections({
          supabase,
          appointmentId: id,
          selections: serviceSelections
        })
      }
    } else if (Array.isArray(serviceIds) && serviceIds.length > 0) {
      const appointmentServices = serviceIds.map((serviceId) => ({
        appointment_id: id,
        service_id: serviceId
      }))

      const { error: servicesError } = await supabase
        .from('appointment_services')
        .insert(appointmentServices)

      if (servicesError) {
        console.error('[api] update appointment services error', servicesError)
      }
    }
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

  const descriptionParts = [appointment.notes, appointment.customers?.address].filter(Boolean)
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
    appointment.customers?.address ? `LOCATION:${escapeText(appointment.customers.address)}` : null,
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
  const { id, token } = req.body || {}
  const file = req.file

  if (!id || !token || !file) {
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

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const path = `pets/${appointment.pet_id}/${uniqueId}.${safeExt}`

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
    await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', appointment.pet_id)
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
    .select('id, pet_id, account_id')
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
      pets ( id, name, breed, weight ),
      appointment_services ( 
        service_id,
        services ( id, name, price )
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
      pet: appointment.pets,
      services: appointment.appointment_services?.map(as => as.services) || [],
      photos: signedUrls
    }
  })
})

export default router
