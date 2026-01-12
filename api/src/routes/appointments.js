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
  series_id,
  series_occurrence,
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
  series_id,
  series_occurrence,
  notes,
  payment_status,
  status,
  reminder_offsets,
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
    pets ( id, name, breed, photo_url, weight ),
    appointment_service_addons ( id, service_addon_id, name, price )
  )
  ,
  photos (
    id,
    appointment_id,
    appointment_service_id,
    service_id,
    pet_id,
    uploader_id,
    type,
    url,
    thumb_url,
    metadata,
    taken_at,
    created_at
  )
`
const APPOINTMENT_RECURRENCE_SELECT = `
  id,
  appointment_date,
  appointment_time,
  duration,
  notes,
  payment_status,
  status,
  reminder_offsets,
  recurrence_rule,
  recurrence_count,
  recurrence_until,
  recurrence_timezone,
  series_id,
  series_occurrence,
  account_id,
  customer_id,
  appointment_services (
    id,
    service_id,
    pet_id,
    price_tier_id,
    price_tier_label,
    price_tier_price,
    appointment_service_addons (
      id,
      service_addon_id
    )
  )
`
const PET_PHOTO_BUCKET = 'pets'
const APPOINTMENT_PHOTO_BUCKET = 'appointments'
const REMINDER_WINDOW_MINUTES = 10
const REMINDER_MAX_OFFSET_MINUTES = 1440
const REMINDER_EXCLUDED_STATUSES = new Set(['cancelled', 'completed', 'in_progress'])
const DEFAULT_REMINDER_OFFSETS = [30]
const MAX_RECURRENCE_OCCURRENCES = 26 // safety limit so we don't explode inserts
const ALLOWED_APPOINTMENT_FIELDS = new Set([
  'appointment_date',
  'appointment_time',
  'duration',
  'notes',
  'status',
  'payment_status',
  'payment_method',
  'payment_amount',
  'amount',
  'customer_id',
  'account_id',
  'before_photo_url',
  'after_photo_url',
  'public_token',
  'confirmation_opened_at',
  'whatsapp_sent_at',
  'source',
  'reminder_offsets',
  'series_id',
  'series_occurrence'
])

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

function addDays(baseDate, days) {
  const copy = new Date(baseDate)
  copy.setDate(copy.getDate() + days)
  return copy
}

function addMonths(baseDate, months) {
  const copy = new Date(baseDate)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function parseRecurrenceRule(rule) {
  if (!rule || typeof rule !== 'string') return null
  const freqMatch = rule.match(/FREQ=([A-Z]+)/)
  const intervalMatch = rule.match(/INTERVAL=(\d+)/)
  const freq = freqMatch?.[1]?.toUpperCase()
  const interval = Number.parseInt(intervalMatch?.[1] || '1', 10)
  if (!freq) return null
  if (!['WEEKLY', 'MONTHLY'].includes(freq)) return null
  return {
    freq,
    interval: Number.isFinite(interval) && interval > 0 ? interval : 1
  }
}

function buildRecurrenceDates({
  startDate,
  rule,
  count,
  until
}) {
  const parsedRule = parseRecurrenceRule(rule)
  if (!parsedRule) return [startDate]

  const base = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(base.getTime())) return [startDate]

  const safeCount = Number.isFinite(Number(count)) ? Math.max(1, Number(count)) : null
  const untilDate = until ? new Date(`${until}T23:59:59`) : null

  const occurrences = [startDate]
  let cursor = new Date(base)

  const maxOccurrences = safeCount || MAX_RECURRENCE_OCCURRENCES

  while (occurrences.length < maxOccurrences) {
    if (parsedRule.freq === 'WEEKLY') {
      cursor = addDays(cursor, 7 * parsedRule.interval)
    } else if (parsedRule.freq === 'MONTHLY') {
      cursor = addMonths(cursor, parsedRule.interval)
    }

    const nextDate = formatLocalDate(cursor)
    if (!nextDate) break
    if (untilDate && cursor > untilDate) break

    occurrences.push(nextDate)
  }

  return occurrences.slice(0, MAX_RECURRENCE_OCCURRENCES)
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
    ; (appointmentServices || []).forEach((row) => {
      const key = `${row.service_id || ''}:${row.pet_id || ''}`
      const bucket = selectionBuckets.get(key) || []
      bucket.push(row.id)
      selectionBuckets.set(key, bucket)
    })

  const fallbackBuckets = new Map()
    ; (appointmentServices || []).forEach((row) => {
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

function buildSelectionsFromAppointment(appointment) {
  if (!appointment || !Array.isArray(appointment.appointment_services)) return []
  return appointment.appointment_services
    .map((entry) => {
      if (!entry) return null
      const addonIds =
        Array.isArray(entry.appointment_service_addons) && entry.appointment_service_addons.length > 0
          ? entry.appointment_service_addons
              .map((addon) => addon?.service_addon_id)
              .filter(Boolean)
          : null
      return {
        service_id: entry.service_id,
        pet_id: entry.pet_id,
        price_tier_id: entry.price_tier_id,
        price_tier_label: entry.price_tier_label,
        price_tier_price: entry.price_tier_price,
        addon_ids: addonIds,
        has_tier_field:
          entry.price_tier_id != null ||
          entry.price_tier_label != null ||
          entry.price_tier_price != null,
        has_addon_field: Boolean(addonIds && addonIds.length > 0),
      }
    })
    .filter((selection) => Boolean(selection?.service_id))
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

// Map common PostgREST auth failures to 401 so clients can refresh tokens instead of seeing 500
function statusFromSupabaseError(error) {
  if (!error) return 500
  const authCodes = new Set(['PGRST301', 'PGRST302', 'PGRST303'])
  if (authCodes.has(error.code)) return 401
  if ((error.message || '').toLowerCase().includes('jwt')) return 401
  return 500
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
      public_token,
      confirmation_opened_at,
      whatsapp_sent_at,
      series_id,
      series_occurrence,
      customers ( id, first_name, last_name, phone, phone_country_code, phone_number, address, address_2 ),
      appointment_services (
        id,
        service_id,
        pet_id,
        price_tier_id,
        price_tier_label,
        price_tier_price,
        services ( id, name, price, display_order ),
        pets ( id, name, breed, photo_url, weight ),
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
    const status = statusFromSupabaseError(error)
    return res.status(status).json({ error: error.message })
  }

  const nextOffset = data.length === limit ? offset + limit : null

  res.json({ data: (data || []).map(mapAppointmentForApi), meta: { nextOffset } })
})

// List occurrences for a given series
router.get('/series/:seriesId/occurrences', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { seriesId } = req.params
  if (!seriesId) return res.status(400).json({ error: 'missing_series_id' })

  try {
    let query = supabase
      .from('appointments')
      .select(APPOINTMENT_DETAIL_SELECT)
      .eq('series_id', seriesId)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (accountId) query = query.eq('account_id', accountId)

    const { data, error } = await query
    if (error) {
      console.error('[api] list series occurrences error', error)
      const status = statusFromSupabaseError(error)
      return res.status(status).json({ error: error.message })
    }
    return res.json({ data: (data || []).map(mapAppointmentForApi) })
  } catch (err) {
    console.error('[api] list series occurrences unexpected', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

router.post('/series/:seriesId/delete', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { seriesId } = req.params
  const { from_date: fromDate } = req.body || {}
  if (!seriesId) return res.status(400).json({ error: 'missing_series_id' })

  try {
    let query = supabase.from('appointments').delete().eq('series_id', seriesId)
    if (accountId) query = query.eq('account_id', accountId)
    if (fromDate) {
      query = query.gte('appointment_date', fromDate)
    }
    const { error } = await query
    if (error) {
      console.error('[api] delete series occurrences error', error)
      const status = statusFromSupabaseError(error)
      return res.status(status).json({ error: error.message })
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error('[api] delete series occurrences unexpected', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// Upload appointment photo (before/after) scoped to appointment x service x pet
router.post('/:id/photos', upload.single('file'), async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase || !accountId) return res.status(401).json({ error: 'Unauthorized' })

  const token = req.headers.authorization
  const bearer = typeof token === 'string' && token.startsWith('Bearer ') ? token.slice(7) : null
  if (!bearer) return res.status(401).json({ error: 'Unauthorized' })

  const { data: userData, error: userError } = await supabase.auth.getUser(bearer)
  if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { data: membership } = await supabase
    .from('account_members')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userData.user.id)
    .eq('status', 'accepted')
    .maybeSingle()
  if (!membership) return res.status(403).json({ error: 'Forbidden' })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const id = req.params.id
  // verify appointment belongs to account
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id')
    .eq('id', id)
    .eq('account_id', accountId)
    .maybeSingle()
  if (!appointment) return res.status(404).json({ error: 'Appointment not found' })

  const typeRaw = (req.body.type || '').toString().toLowerCase()
  const type = typeRaw === 'after' ? 'after' : 'before'

  const appointmentServiceId = req.body.appointment_service_id || req.body.appointmentServiceId || null
  const serviceId = req.body.service_id || req.body.serviceId || null
  const petId = req.body.pet_id || req.body.petId || null

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const filename = `${id}-${serviceId || 'noservice'}-${petId || 'nopic'}-${type}-${uniqueId}.${safeExt}`
  const path = `appointments/${id}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from(APPOINTMENT_PHOTO_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    console.error('[api] storage upload error', JSON.stringify(uploadError, null, 2))
    return res.status(500).json({ error: uploadError.message || 'storage_upload_failed', details: uploadError })
  }

  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from(APPOINTMENT_PHOTO_BUCKET)
    .createSignedUrl(path, 604800)
  if (signedError) return res.status(500).json({ error: signedError.message })
  const url = signedUrlData?.signedUrl || null

  const metadata = {
    storage_path: path,
    content_type: file.mimetype || null,
    size: file.size || null
  }

  const insertPayload = {
    account_id: accountId,
    appointment_id: id,
    appointment_service_id: appointmentServiceId,
    service_id: serviceId,
    pet_id: petId,
    uploader_id: userData.user.id,
    type,
    url,
    thumb_url: null,
    metadata: metadata
  }

  const { data: inserted, error: insertError } = await supabase
    .from('photos')
    .insert([insertPayload])
    .select()
    .single()

  if (insertError) {
    console.error('[api] insert photo error', JSON.stringify(insertError, null, 2))
    // Return the error details to help debugging (non-sensitive fields only)
    return res.status(500).json({ error: insertError.message || 'insert_failed', details: insertError })
  }

  res.status(201).json({ data: inserted })
})

// List photos for an appointment
router.get('/:id/photos', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const id = req.params.id
  const { service_id: serviceId, pet_id: petId, type } = req.query || {}

  let query = supabase.from('photos').select('*').eq('appointment_id', id)
  if (serviceId) query = query.eq('service_id', serviceId)
  if (petId) query = query.eq('pet_id', petId)
  if (type) query = query.eq('type', type)

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) {
    console.error('[api] list appointment photos error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

// Delete photo by id
router.delete('/photos/:photoId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase || !accountId) return res.status(401).json({ error: 'Unauthorized' })

  const token = req.headers.authorization
  const bearer = typeof token === 'string' && token.startsWith('Bearer ') ? token.slice(7) : null
  if (!bearer) return res.status(401).json({ error: 'Unauthorized' })

  const { data: userData, error: userError } = await supabase.auth.getUser(bearer)
  if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Unauthorized' })

  const { data: membership } = await supabase
    .from('account_members')
    .select('id')
    .eq('account_id', accountId)
    .eq('user_id', userData.user.id)
    .eq('status', 'accepted')
    .maybeSingle()
  if (!membership) return res.status(403).json({ error: 'Forbidden' })

  const photoId = req.params.photoId
  const { data: photo, error: pErr } = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .eq('account_id', accountId)
    .maybeSingle()
  if (pErr) return res.status(500).json({ error: pErr.message })
  if (!photo) return res.status(404).json({ error: 'not_found' })

  // Attempt to remove object from storage if we have path
  const storagePath = photo?.metadata?.storage_path || null
  if (storagePath) {
    try {
      await supabase.storage.from(APPOINTMENT_PHOTO_BUCKET).remove([storagePath])
    } catch (e) {
      console.warn('[api] remove storage object warning', e)
    }
  }

  const { error: delErr } = await supabase.from('photos').delete().eq('id', photoId).eq('account_id', accountId)
  if (delErr) return res.status(500).json({ error: delErr.message })

  res.status(204).send()
})

// Lightweight count of overdue/unpaid completed appointments
router.get('/overdue-count', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const today = formatLocalDate(new Date())

    let query = supabase.from('appointments').select('id', { count: 'exact', head: true })

    if (accountId) query = query.eq('account_id', accountId)
    query = query.eq('status', 'completed')
    query = query.neq('payment_status', 'paid')
    query = query.lte('appointment_date', today)

    const { error, count } = await query
    if (error) {
      console.error('[api] overdue-count error', error)
      const status = statusFromSupabaseError(error)
      return res.status(status).json({ error: error.message })
    }

    return res.json({ count: Number(count || 0) })
  } catch (err) {
    console.error('[api] overdue-count unexpected error', err)
    return res.status(500).json({ error: 'internal_error' })
  }
})

router.post('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const supabaseAdmin = getSupabaseServiceRoleClient() || supabase
  const raw = { ...(req.body || {}) }
  const recurrenceRule = raw.recurrence_rule || null
  const recurrenceCount = raw.recurrence_count || null
  const recurrenceUntil = raw.recurrence_until || null
  const recurrenceTimezone = raw.recurrence_timezone || null
  const serviceSelections = raw.service_selections
  const normalizedSelections = normalizeServiceSelections(serviceSelections)

  // Whitelist only appointment columns to avoid passing unknown fields to Supabase
  const payload = {}
  for (const key of Object.keys(raw)) {
    if (ALLOWED_APPOINTMENT_FIELDS.has(key)) {
      payload[key] = raw[key]
    }
  }

  if (accountId) {
    payload.account_id = accountId
  }

  if (!Array.isArray(serviceSelections) || normalizedSelections.length === 0) {
    return res.status(400).json({ error: 'service_selections_required' })
  }
  if (normalizedSelections.some((selection) => !selection.pet_id)) {
    return res.status(400).json({ error: 'pet_required' })
  }

  const occurrenceDates =
    recurrenceRule && payload.appointment_date
      ? buildRecurrenceDates({
        startDate: payload.appointment_date,
        rule: recurrenceRule,
        count: recurrenceCount,
        until: recurrenceUntil
      })
      : [payload.appointment_date]

  const createdAppointments = []
  let seriesId = null

  if (recurrenceRule) {
    const { data: series, error: seriesError } = await supabaseAdmin
      .from('appointment_series')
      .insert({
        account_id: payload.account_id || accountId || null,
        recurrence_rule: recurrenceRule,
        recurrence_count: recurrenceCount || null,
        recurrence_until: recurrenceUntil || null,
        start_date: payload.appointment_date,
        start_time: payload.appointment_time || null,
        duration: payload.duration || null,
        notes: payload.notes || null,
        timezone: recurrenceTimezone || null,
        status: 'active'
      })
      .select('id')
      .maybeSingle()

    if (seriesError) {
      console.error('[api] create appointment series error', seriesError)
      const status = statusFromSupabaseError(seriesError) || 500
      return res.status(status).json({ error: seriesError.message })
    }
    seriesId = series?.id || null
  }

  const createAppointmentWithSelections = async (appointmentPayload) => {
    const { data: appointment, error } = await supabase.from('appointments').insert(appointmentPayload).select().single()

    if (error) {
      console.error('[api] create appointment error', error)
      throw error
    }

    const appointmentServices = normalizedSelections.map((selection) => ({
      appointment_id: appointment.id,
      service_id: selection.service_id,
      pet_id: selection.pet_id || null
    }))

    const { error: servicesError } = await supabase
      .from('appointment_services')
      .insert(appointmentServices)

    if (servicesError) {
      console.error('[api] create appointment services error', servicesError)
      throw servicesError
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

    return appointment
  }

  try {
    for (const date of occurrenceDates) {
      const appointmentPayload = {
        ...payload,
        appointment_date: date,
        series_id: seriesId,
        series_occurrence: date
      }
      const created = await createAppointmentWithSelections(appointmentPayload)
      createdAppointments.push(created)
    }
  } catch (err) {
    // Attempt cleanup if any were created before failing
    const createdIds = createdAppointments.map((apt) => apt.id).filter(Boolean)
    if (createdIds.length > 0) {
      await supabase.from('appointments').delete().in('id', createdIds)
      await supabase.from('appointment_services').delete().in('appointment_id', createdIds)
    }
    if (seriesId) {
      await supabase.from('appointment_series').delete().eq('id', seriesId)
    }
    const status = statusFromSupabaseError(err) || 500
    return res.status(status).json({ error: err?.message || 'create_error' })
  }

  let responseAppointment = createdAppointments[0]
  if (responseAppointment?.id) {
    const { data: refreshed, error: refreshError } = await supabase
      .from('appointments')
      .select(APPOINTMENT_DETAIL_SELECT)
      .eq('id', responseAppointment.id)
      .maybeSingle()
    if (refreshError) {
      console.error('[api] reload appointment error', refreshError)
    } else if (refreshed) {
      responseAppointment = refreshed
    }
  }

  res.status(201).json({
    data: mapAppointmentForApi(responseAppointment),
    meta: { created: createdAppointments.length, series_id: seriesId }
  })
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
  const supabaseAdmin = getSupabaseServiceRoleClient() || supabase
  const { id } = req.params
  const payload = req.body || {}
  const updateScope = payload.update_scope || "future"
  const scopeSingle = updateScope === "single"
  delete payload.update_scope
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
    'recurrence_rule',
    'recurrence_count',
    'recurrence_until',
    'recurrence_timezone',
  ]

  const updates = {}
  allowed.forEach((key) => {
    if (payload[key] !== undefined) updates[key] = payload[key]
  })

  const shouldUpdateAppointment = Object.keys(updates).length > 0
  const shouldUpdateServices = normalizedSelections.length > 0
  const servicesChanged = shouldUpdateServices

  if (!shouldUpdateAppointment && !shouldUpdateServices) {
    return res.status(400).json({ error: 'No fields to update' })
  }

  let previousAppointment = null
  {
    let prevQuery = supabase.from('appointments').select(APPOINTMENT_RECURRENCE_SELECT).eq('id', id)
    if (accountId) prevQuery = prevQuery.eq('account_id', accountId)
    const { data: prevData, error: prevError } = await prevQuery.maybeSingle()
    if (prevError) {
      console.error('[api] load appointment error', prevError)
      return res.status(500).json({ error: prevError.message })
    }
    if (!prevData) {
      return res.status(404).json({ error: 'Not found' })
    }
    previousAppointment = prevData
  }

  let appointment = null
  if (shouldUpdateAppointment) {
    let query = supabase.from('appointments').update(updates).eq('id', id)
    if (accountId) {
      query = query.eq('account_id', accountId)
    }

    const { data, error } = await query.select(APPOINTMENT_RECURRENCE_SELECT).single()

    if (error) {
      console.error('[api] update appointment error', error)
      return res.status(500).json({ error: error.message })
    }

    appointment = data
  } else {
    appointment = previousAppointment
  }

  // Update appointment services if provided
  if (shouldUpdateServices) {
    const { data: existingServices, error: existingErr } = await supabase
      .from('appointment_services')
      .select('id,service_id,pet_id')
      .eq('appointment_id', id)

    if (existingErr) {
      console.error('[api] load existing appointment services error', existingErr)
      return res.status(500).json({ error: existingErr.message })
    }

    const existingMap = new Map()
    ;(existingServices || []).forEach((row) => {
      const key = `${row.service_id || ''}:${row.pet_id || ''}`
      existingMap.set(key, row.id)
    })

    const desiredKeys = new Set()
    const toInsert = []
    normalizedSelections.forEach((selection) => {
      const key = `${selection.service_id || ''}:${selection.pet_id || ''}`
      desiredKeys.add(key)
      if (!existingMap.has(key)) {
        toInsert.push({ appointment_id: id, service_id: selection.service_id, pet_id: selection.pet_id || null })
      }
    })

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('appointment_services').insert(toInsert)
      if (insertErr) {
        console.error('[api] insert appointment services error', insertErr)
        return res.status(500).json({ error: insertErr.message })
      }
    }

    const toDeleteIds = (existingServices || []).filter((row) => {
      const key = `${row.service_id || ''}:${row.pet_id || ''}`
      return !desiredKeys.has(key)
    }).map((r) => r.id)

    if (toDeleteIds.length > 0) {
      const { error: delErr } = await supabase.from('appointment_services').delete().in('id', toDeleteIds)
      if (delErr) {
        console.error('[api] delete obsolete appointment services error', delErr)
        return res.status(500).json({ error: delErr.message })
      }
    }

    await applyServiceSelections({ supabase, appointmentId: id, selections: serviceSelections })

    const { data: refreshedAfterServices, error: serviceRefreshError } = await supabase
      .from('appointments')
      .select(APPOINTMENT_RECURRENCE_SELECT)
      .eq('id', id)
      .maybeSingle()

    if (serviceRefreshError) {
      console.error('[api] reload appointment services error', serviceRefreshError)
    } else if (refreshedAfterServices) {
      appointment = refreshedAfterServices
    }
  }

  let updatedAppointment = appointment || previousAppointment
  const previousSeriesId = previousAppointment?.series_id
  let currentSeriesId = updatedAppointment?.series_id || previousSeriesId
  const recurrenceCountValue = Number.isFinite(updatedAppointment?.recurrence_count ?? NaN)
    ? updatedAppointment?.recurrence_count
    : null
  const recurrenceUntilValue = updatedAppointment?.recurrence_until || null
  const recurrenceTimezoneValue = updatedAppointment?.recurrence_timezone || null
  const recurrenceFieldsChanged =
    (previousAppointment?.recurrence_rule ?? null) !== (updatedAppointment?.recurrence_rule ?? null) ||
    (previousAppointment?.recurrence_count ?? null) !== (updatedAppointment?.recurrence_count ?? null) ||
    (previousAppointment?.recurrence_until ?? null) !== (updatedAppointment?.recurrence_until ?? null) ||
    (previousAppointment?.recurrence_timezone ?? null) !== (updatedAppointment?.recurrence_timezone ?? null)
  const dateChanged =
    (previousAppointment?.appointment_date ?? null) !== (updatedAppointment?.appointment_date ?? null)
  const timeChanged =
    (previousAppointment?.appointment_time ?? null) !== (updatedAppointment?.appointment_time ?? null)
  const hasRule = Boolean(updatedAppointment?.recurrence_rule)
  if (hasRule && !currentSeriesId && !scopeSingle) {
    const startDate = updatedAppointment?.appointment_date
    if (startDate) {
      const { data: newSeries, error: seriesError } = await supabaseAdmin
        .from('appointment_series')
        .insert({
          account_id: updatedAppointment.account_id || accountId || null,
          recurrence_rule: updatedAppointment.recurrence_rule,
          recurrence_count: recurrenceCountValue,
          recurrence_until: recurrenceUntilValue,
          start_date: startDate,
          start_time: updatedAppointment.appointment_time || null,
          duration: updatedAppointment.duration ?? null,
          notes: updatedAppointment.notes ?? null,
          timezone: recurrenceTimezoneValue || null,
          status: 'active',
        })
        .select('id')
        .maybeSingle()

      if (seriesError) {
        console.error('[api] create appointment series error', seriesError)
        const status = statusFromSupabaseError(seriesError) || 500
        return res.status(status).json({ error: seriesError.message || 'recurrence_series_create_failed' })
      }

      currentSeriesId = newSeries?.id || null
      if (currentSeriesId) {
        let assignSeriesQuery = supabase
          .from('appointments')
          .update({
            series_id: currentSeriesId,
            series_occurrence: updatedAppointment.appointment_date,
          })
          .eq('id', id)
        if (accountId) assignSeriesQuery = assignSeriesQuery.eq('account_id', accountId)
        const { data: assigned, error: assignError } = await assignSeriesQuery
          .select(APPOINTMENT_RECURRENCE_SELECT)
          .single()
        if (assignError) {
          console.error('[api] assign appointment series error', assignError)
          const status = statusFromSupabaseError(assignError) || 500
          return res.status(status).json({ error: assignError.message || 'recurrence_series_assign_failed' })
        }
        updatedAppointment = assigned
      }
    }
  }

  const needsRebuild =
    !scopeSingle &&
    currentSeriesId &&
    hasRule &&
    (recurrenceFieldsChanged ||
      dateChanged ||
      timeChanged ||
      !previousSeriesId ||
      servicesChanged)

  if (needsRebuild) {
    const baseDate = updatedAppointment?.appointment_date
    const baseTime = updatedAppointment?.appointment_time || null

    if (baseDate) {
      const baseDateObj = new Date(`${baseDate}T00:00:00`)
      if (!Number.isNaN(baseDateObj.getTime())) {
        const fromDate = formatLocalDate(addDays(baseDateObj, 1))

        const { error: seriesError } = await supabase
          .from('appointment_series')
          .update({
            recurrence_rule: updatedAppointment.recurrence_rule,
            recurrence_count: recurrenceCountValue,
            recurrence_until: recurrenceUntilValue,
            timezone: recurrenceTimezoneValue,
            start_date: baseDate,
            start_time: baseTime,
            duration: updatedAppointment.duration ?? null,
            notes: updatedAppointment.notes ?? null,
            status: 'active',
          })
          .eq('id', currentSeriesId)

        if (seriesError) {
          console.error('[api] update appointment series error', seriesError)
          const status = statusFromSupabaseError(seriesError) || 500
          return res.status(status).json({
            error: seriesError.message || 'recurrence_update_failed',
          })
        }

        if (fromDate) {
          let deleteQuery = supabase
            .from('appointments')
            .delete()
            .eq('series_id', currentSeriesId)
            .gte('appointment_date', fromDate)
          if (accountId) deleteQuery = deleteQuery.eq('account_id', accountId)
          const { error: deleteError } = await deleteQuery
          if (deleteError) {
            console.error('[api] delete series occurrences error', deleteError)
            const status = statusFromSupabaseError(deleteError) || 500
            return res.status(status).json({ error: deleteError.message })
          }
        }

        const recurrenceDates = buildRecurrenceDates({
          startDate: baseDate,
          rule: updatedAppointment.recurrence_rule,
          count: recurrenceCountValue,
          until: recurrenceUntilValue,
        })
        const futureDates = recurrenceDates.slice(1)
        let appointmentSnapshot = updatedAppointment
        if (
          !appointmentSnapshot?.appointment_services ||
          appointmentSnapshot.appointment_services.length === 0
        ) {
          const { data: serviceRows, error: serviceRowsError } = await supabase
            .from('appointment_services')
            .select(`
              id,
              service_id,
              pet_id,
              price_tier_id,
              price_tier_label,
              price_tier_price,
              appointment_service_addons (
                id,
                service_addon_id
              )
            `)
            .eq('appointment_id', id)
          if (serviceRowsError) {
            console.error('[api] load appointment services error', serviceRowsError)
          } else if (serviceRows && serviceRows.length > 0) {
            appointmentSnapshot = {
              ...(appointmentSnapshot || {}),
              appointment_services: serviceRows,
            }
          }
        }
        const futureSelections = normalizeServiceSelections(
          buildSelectionsFromAppointment(appointmentSnapshot || updatedAppointment)
        )

        if (futureDates.length > 0 && futureSelections.length > 0) {
          const insertedAppointmentIds = []
          const accountingId = updatedAppointment.account_id || accountId || null
          const serviceIds = Array.from(
            new Set(futureSelections.map((selection) => selection.service_id).filter(Boolean))
          )

          try {
            for (const occurrenceDate of futureDates) {
                const insertPayload = {
                  account_id: accountingId,
                  customer_id: updatedAppointment.customer_id || null,
                  appointment_date: occurrenceDate,
                  appointment_time: baseTime,
                  duration: updatedAppointment.duration ?? null,
                  notes: updatedAppointment.notes ?? null,
                  status: 'scheduled',
                  payment_status: 'unpaid',
                  amount: updatedAppointment.amount ?? null,
                  reminder_offsets: Array.isArray(updatedAppointment.reminder_offsets)
                    ? updatedAppointment.reminder_offsets
                    : null,
                  recurrence_rule: updatedAppointment.recurrence_rule,
                  recurrence_count: recurrenceCountValue,
                  recurrence_until: recurrenceUntilValue,
                  recurrence_timezone: recurrenceTimezoneValue,
                  series_id: currentSeriesId,
                  series_occurrence: occurrenceDate,
                }

              const { data: created, error: insertError } = await supabase
                .from('appointments')
                .insert(insertPayload)
                .select('id')
                .single()

              if (insertError) throw insertError
              if (!created?.id) continue

              insertedAppointmentIds.push(created.id)

              const appointmentServices = futureSelections.map((selection) => ({
                appointment_id: created.id,
                service_id: selection.service_id,
                pet_id: selection.pet_id || null,
              }))

              if (appointmentServices.length > 0) {
                const { error: servicesError } = await supabase
                  .from('appointment_services')
                  .insert(appointmentServices)

                if (servicesError) throw servicesError

                await applyServiceSelections({
                  supabase,
                  appointmentId: created.id,
                  selections: futureSelections,
                })
              }
            }
          } catch (recurrenceError) {
            if (insertedAppointmentIds.length > 0) {
              await supabase.from('appointments').delete().in('id', insertedAppointmentIds)
            }
            console.error('[api] recreate series occurrences error', recurrenceError)
            const status = statusFromSupabaseError(recurrenceError) || 500
            return res.status(status).json({
              error: recurrenceError?.message || 'recurrence_update_failed',
            })
          }
        }
      }
    }
  } else if (previousSeriesId && !hasRule) {
    const baseDate = updatedAppointment?.appointment_date || previousAppointment?.appointment_date
    if (previousSeriesId && baseDate) {
      const baseDateObj = new Date(`${baseDate}T00:00:00`)
      if (!Number.isNaN(baseDateObj.getTime())) {
        const fromDate = formatLocalDate(addDays(baseDateObj, 1))
        if (fromDate) {
          let deleteQuery = supabase
            .from('appointments')
            .delete()
            .eq('series_id', previousSeriesId)
            .gte('appointment_date', fromDate)
          if (accountId) deleteQuery = deleteQuery.eq('account_id', accountId)
          const { error: deleteError } = await deleteQuery
          if (deleteError) {
            console.error('[api] delete series occurrences error', deleteError)
            const status = statusFromSupabaseError(deleteError) || 500
            return res.status(status).json({ error: deleteError.message })
          }
        }
      }
    }

    let clearSeriesQuery = supabase
      .from('appointments')
      .update({
        series_id: null,
        series_occurrence: null,
      })
      .eq('id', id)
    if (accountId) clearSeriesQuery = clearSeriesQuery.eq('account_id', accountId)
    const { error: clearSeriesError } = await clearSeriesQuery
    if (clearSeriesError) {
      console.error('[api] clear appointment series reference error', clearSeriesError)
      const status = statusFromSupabaseError(clearSeriesError) || 500
      return res.status(status).json({ error: clearSeriesError.message })
    }

    updatedAppointment = {
      ...(updatedAppointment || {}),
      series_id: null,
      series_occurrence: null,
    }

    let deleteSeriesQuery = supabase
      .from('appointment_series')
      .delete()
      .eq('id', previousSeriesId)
    if (accountId) deleteSeriesQuery = deleteSeriesQuery.eq('account_id', accountId)
    const { error: seriesDeleteError } = await deleteSeriesQuery
    if (seriesDeleteError) {
      console.error('[api] delete appointment series error', seriesDeleteError)
      const status = statusFromSupabaseError(seriesDeleteError) || 500
      return res.status(status).json({ error: seriesDeleteError.message })
    }
  }

  let responseAppointment = updatedAppointment
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
    'PRODID:-//Pawmi//EN',
    'BEGIN:VEVENT',
    `UID:${appointment.id}@pawmi`,
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
    console.error('[api] appointment photo upload error', JSON.stringify(uploadError, null, 2))
    return res.status(500).json({ error: uploadError.message || 'Upload failed', details: uploadError })
  }

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('appointments')
    .createSignedUrl(path, 604800)

  if (signedError) return res.status(500).json({ error: signedError.message })
  const publicUrl = signedUrlData?.signedUrl || null

  if (publicUrl) {
    // Do not write to legacy appointment-level columns anymore.
    // Insert into `photos` table scoped to this appointment so new clients read the canonical source.
    const metadata = {
      storage_path: path,
      content_type: file.mimetype || null,
      size: file.size || null
    }

    const insertPayload = {
      account_id: appointment.account_id || null,
      appointment_id: id,
      appointment_service_id: null,
      service_id: null,
      pet_id: null,
      uploader_id: null,
      type,
      url: publicUrl,
      thumb_url: null,
      metadata
    }

    try {
      await supabase.from('photos').insert([insertPayload])
    } catch (e) {
      console.error('[api] insert legacy-upload photo error', e)
    }
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
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Service unavailable' })
  }

  const { data: members, error: membersError } = await supabaseAdmin
    .from('account_members')
    .select('account_id, user_id')
    .eq('status', 'accepted')

  if (membersError) {
    return res.status(500).json({ error: membersError.message })
  }

  const membersByAccount = new Map()
  const userIds = new Set()

    ; (members || []).forEach((row) => {
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
    return res.status(500).json({ error: preferencesError.message })
  }

  const defaultPreferences = normalizeNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES)
  const preferencesByUser = new Map()
  userIds.forEach((userId) => {
    preferencesByUser.set(userId, defaultPreferences)
  })

    ; (preferenceRows || []).forEach((row) => {
      if (!row?.user_id) return
      preferencesByUser.set(row.user_id, normalizeNotificationPreferences(row.preferences))
    })

  const offsetsByUser = new Map()
  const reminderEnabledUsers = new Set()
  preferencesByUser.forEach((preferences, userId) => {
    if (!shouldSendNotification(preferences, 'appointments.reminder')) return
    reminderEnabledUsers.add(userId)

    const offsets = normalizeReminderOffsets(
      preferences?.push?.appointments?.reminder_offsets,
      []
    )
    if (offsets.length) offsetsByUser.set(userId, offsets)
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

  const startDate = rangeStart.toISOString().slice(0, 10)
  const endDate = rangeEnd.toISOString().slice(0, 10)

  const { data: appointments, error: appointmentsError } = await supabaseAdmin
    .from('appointments')
    .select('id, account_id, appointment_date, appointment_time, status, reminder_offsets')
    .gte('appointment_date', startDate)
    .lte('appointment_date', endDate)

  if (appointmentsError) {
    return res.status(500).json({ error: appointmentsError.message })
  }

  const dedupeStart = new Date(now.getTime() - (maxOffset + windowMinutes) * 60 * 1000)
  const { data: existingNotifications } = await supabaseAdmin
    .from('notifications')
    .select('user_id, payload')
    .eq('type', 'appointments.reminder')
    .in('user_id', Array.from(reminderEnabledUsers))
    .gte('created_at', dedupeStart.toISOString())

  const alreadySent = new Set()
    ; (existingNotifications || []).forEach((row) => {
      const payload = row?.payload || {}
      const appointmentId = payload.appointmentId || payload.appointment_id
      const offset = payload.reminderOffsetMinutes || payload.offsetMinutes || payload.offset_minutes

      if (!row?.user_id || !appointmentId || !offset) return
      alreadySent.add(`${row.user_id}:${appointmentId}:${offset}`)
    })

  const queuedByReminder = new Map()
  const windowStartMs = windowStart.getTime()
  const windowEndMs = windowEnd.getTime()

    ; (appointments || []).forEach((appointment) => {
      if (!appointment?.account_id) return
      if (appointment.status && REMINDER_EXCLUDED_STATUSES.has(appointment.status)) return
      const appointmentDateTime = parseAppointmentDateTime(appointment)
      if (!appointmentDateTime) return
      const accountMembers = membersByAccount.get(appointment.account_id)
      if (!accountMembers) return
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

  const summary = {
    processed: appointments?.length || 0,
    reminders: 0,
    sent: 0,
    failed: 0,
    skipped: 0
  }

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

  // Fetch appointment (photos are fetched separately from `photos` table)
  const { data: appointment, error } = await supabase
    .from('appointments')
    .select(`
      id,
      appointment_date,
      appointment_time,
      status,
      notes,
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

  // Generate temporary signed URLs for stored photos (valid for 7 days)
  const signedUrls = {}
  try {
    const { data: photos } = await supabase
      .from('photos')
      .select('id, type, metadata, url')
      .eq('appointment_id', id)
      .order('created_at', { ascending: false })

    if (Array.isArray(photos) && photos.length > 0) {
      const before = photos.find((p) => p.type === 'before')
      const after = photos.find((p) => p.type === 'after')

      if (before) {
        const storagePath = before.metadata?.storage_path || null
        if (storagePath) {
          const { data } = await supabase.storage.from('appointments').createSignedUrl(storagePath, 604800)
          if (data?.signedUrl) signedUrls.beforePhoto = data.signedUrl
        } else if (before.url) {
          signedUrls.beforePhoto = before.url
        }
      }

      if (after) {
        const storagePath = after.metadata?.storage_path || null
        if (storagePath) {
          const { data } = await supabase.storage.from('appointments').createSignedUrl(storagePath, 604800)
          if (data?.signedUrl) signedUrls.afterPhoto = data.signedUrl
        } else if (after.url) {
          signedUrls.afterPhoto = after.url
        }
      }
    }
  } catch (e) {
    console.warn('[api] generate share signed urls warning', e)
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
