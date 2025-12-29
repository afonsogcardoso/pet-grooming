import { Router } from 'express'
import crypto from 'crypto'
import multer from 'multer'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const SERVICE_IMAGE_BUCKET = 'service-images'

const SERVICE_SELECT_FIELDS =
  'id,name,default_duration,price,active,description,display_order,category,subcategory,pet_type,pricing_model,image_url'

function parseNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

async function ensureServiceAccess({ supabase, serviceId, accountId }) {
  if (!accountId) {
    return { error: { status: 400, message: 'accountId is required' } }
  }

  const { data, error } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (error) {
    return { error: { status: 500, message: error.message } }
  }

  if (!data) {
    return { error: { status: 404, message: 'Service not found' } }
  }

  return { ok: true }
}

router.get('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  let query = supabase
    .from('services')
    .select(SERVICE_SELECT_FIELDS)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.limit(200)

  if (error) {
    console.error('[api] services error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data })
})

router.post('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const payload = sanitizeBody(req.body || {})
  const mapped = payload
  if (accountId) {
    mapped.account_id = accountId
  }

  // Normalize/validate common numeric fields to avoid DB check violations
  if (mapped.default_duration == null || mapped.default_duration === '') {
    // sensible default: 10 minutes
    mapped.default_duration = 10
  } else {
    mapped.default_duration = Number(mapped.default_duration)
    if (Number.isNaN(mapped.default_duration)) mapped.default_duration = 10
  }

  if (mapped.price != null && mapped.price !== '') {
    mapped.price = Number(mapped.price)
    if (Number.isNaN(mapped.price)) mapped.price = null
  }

  // Ensure display_order is numeric when provided
  if (mapped.display_order != null && mapped.display_order !== '') {
    mapped.display_order = Number(mapped.display_order)
    if (Number.isNaN(mapped.display_order)) mapped.display_order = undefined
  }

  const { data, error } = await supabase.from('services').insert([mapped]).select(SERVICE_SELECT_FIELDS)

  if (error) {
    console.error('[api] create service error', error)
    // If DB reports a check-constraint violation, return 400 with helpful message
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Invalid service payload: failed DB validation', details: error.message })
    }
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

router.patch('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const payload = sanitizeBody(req.body || {})

  // Support soft-delete via _delete flag
  const updatePayload = payload._delete
    ? { deleted_at: new Date().toISOString() }
    : payload

  let query = supabase.from('services').update(updatePayload).eq('id', id)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.select(SERVICE_SELECT_FIELDS)

  if (error) {
    console.error('[api] update service error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data })
})

router.delete('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params

  let query = supabase.from('services').delete().eq('id', id)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { error } = await query

  if (error) {
    console.error('[api] delete service error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ ok: true })
})

router.post('/:id/image', upload.single('file'), async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase || !accountId) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const path = `services/${id}/${uniqueId}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(SERVICE_IMAGE_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    console.error('[api] service image upload error', uploadError)
    return res.status(500).json({ error: uploadError.message })
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(path)

  if (publicUrl) {
    await supabase
      .from('services')
      .update({ image_url: publicUrl })
      .eq('id', id)
      .eq('account_id', accountId)
  }

  return res.json({ url: publicUrl })
})

router.get('/:id/price-tiers', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const { data, error } = await supabase
    .from('service_price_tiers')
    .select('id,service_id,label,min_weight_kg,max_weight_kg,price,display_order')
    .eq('service_id', id)
    .order('display_order', { ascending: true })
    .order('min_weight_kg', { ascending: true })

  if (error) {
    console.error('[api] list service price tiers error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.post('/:id/price-tiers', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const payload = sanitizeBody(req.body || {})
  payload.service_id = id
  payload.min_weight_kg = parseNumber(payload.min_weight_kg)
  payload.max_weight_kg = parseNumber(payload.max_weight_kg)
  payload.price = parseNumber(payload.price)
  payload.display_order = parseNumber(payload.display_order)

  if (payload.price == null) {
    return res.status(400).json({ error: 'price is required' })
  }

  const { data, error } = await supabase
    .from('service_price_tiers')
    .insert([payload])
    .select('id,service_id,label,min_weight_kg,max_weight_kg,price,display_order')

  if (error) {
    console.error('[api] create service price tier error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

router.patch('/:id/price-tiers/:tierId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id, tierId } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const payload = sanitizeBody(req.body || {})
  delete payload.service_id
  if (payload.min_weight_kg != null) payload.min_weight_kg = parseNumber(payload.min_weight_kg)
  if (payload.max_weight_kg != null) payload.max_weight_kg = parseNumber(payload.max_weight_kg)
  if (payload.price != null) payload.price = parseNumber(payload.price)
  if (payload.display_order != null) payload.display_order = parseNumber(payload.display_order)

  const { data, error } = await supabase
    .from('service_price_tiers')
    .update(payload)
    .eq('id', tierId)
    .eq('service_id', id)
    .select('id,service_id,label,min_weight_kg,max_weight_kg,price,display_order')

  if (error) {
    console.error('[api] update service price tier error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data })
})

router.delete('/:id/price-tiers/:tierId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id, tierId } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const { error } = await supabase
    .from('service_price_tiers')
    .delete()
    .eq('id', tierId)
    .eq('service_id', id)

  if (error) {
    console.error('[api] delete service price tier error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(204).send()
})

router.get('/:id/addons', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const { data, error } = await supabase
    .from('service_addons')
    .select('id,service_id,name,description,price,active,display_order')
    .eq('service_id', id)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    console.error('[api] list service addons error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.post('/:id/addons', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const payload = sanitizeBody(req.body || {})
  payload.service_id = id
  payload.price = parseNumber(payload.price)
  payload.display_order = parseNumber(payload.display_order)

  if (!payload.name) {
    return res.status(400).json({ error: 'name is required' })
  }
  if (payload.price == null) {
    return res.status(400).json({ error: 'price is required' })
  }

  const { data, error } = await supabase
    .from('service_addons')
    .insert([payload])
    .select('id,service_id,name,description,price,active,display_order')

  if (error) {
    console.error('[api] create service addon error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

router.patch('/:id/addons/:addonId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id, addonId } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const payload = sanitizeBody(req.body || {})
  delete payload.service_id
  if (payload.price != null) payload.price = parseNumber(payload.price)
  if (payload.display_order != null) payload.display_order = parseNumber(payload.display_order)

  const { data, error } = await supabase
    .from('service_addons')
    .update(payload)
    .eq('id', addonId)
    .eq('service_id', id)
    .select('id,service_id,name,description,price,active,display_order')

  if (error) {
    console.error('[api] update service addon error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data })
})

router.delete('/:id/addons/:addonId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  const { id, addonId } = req.params
  const access = await ensureServiceAccess({ supabase, serviceId: id, accountId })
  if (access.error) return res.status(access.error.status).json({ error: access.error.message })

  const { error } = await supabase
    .from('service_addons')
    .delete()
    .eq('id', addonId)
    .eq('service_id', id)

  if (error) {
    console.error('[api] delete service addon error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(204).send()
})

export default router
