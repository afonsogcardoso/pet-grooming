import { Router } from 'express'
import multer from 'multer'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'

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
  customers ( id, name, phone, address ),
  pets ( id, name, breed, photo_url ),
  services ( id, name )
`
const PET_PHOTO_BUCKET = 'pet-photos'

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
      customers ( id, name, phone, address ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url )
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

  res.json({ data, meta: { nextOffset } })
})

router.post('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const payload = { ...(req.body || {}) }

  if (accountId) {
    payload.account_id = accountId
  }

  const { data, error } = await supabase.from('appointments').insert(payload).select()

  if (error) {
    console.error('[api] create appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

// Get single appointment
router.get('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params

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
      customers ( id, name, phone, address ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url )
    `
    )
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

  res.json({ data })
})

router.patch('/:id/status', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
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
      customers ( id, name, phone, address ),
      services ( id, name, price ),
      pets ( id, name, breed, photo_url )
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

  res.json({ data })
})

router.patch('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const payload = req.body || {}

  const allowed = [
    'status',
    'payment_status',
    'notes',
    'duration',
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

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' })
  }

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
    customers ( id, name, phone, address ),
    services ( id, name, price ),
    pets ( id, name, breed, photo_url )
  `
  )

  if (error) {
    console.error('[api] update appointment error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data })
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

  const titleParts = [appointment.services?.name, appointment.pets?.name || appointment.customers?.name || ''].filter(
    Boolean
  )
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

  const { data: publicUrlData } = supabase.storage.from(PET_PHOTO_BUCKET).getPublicUrl(path)
  const publicUrl = publicUrlData?.publicUrl || null

  if (publicUrl) {
    await supabase.from('pets').update({ photo_url: publicUrl }).eq('id', appointment.pet_id)
  }

  return res.json({ ok: true, url: publicUrl })
})

export default router
