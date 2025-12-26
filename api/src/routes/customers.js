import { Router } from 'express'
import multer from 'multer'
import crypto from 'crypto'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'
import { normalizePhoneParts } from '../utils/phone.js'
import { mapCustomerForApi } from '../utils/customer.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const PET_PHOTO_BUCKET = 'pets'

function applyPhonePayload(payload) {
  if (Object.prototype.hasOwnProperty.call(payload, 'phone_country_code')) {
    delete payload.phone_country_code
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'phone_number')) {
    delete payload.phone_number
  }

  let hasPhonePayload = false
  if (payload.phone !== undefined) hasPhonePayload = true
  if (payload.phoneCountryCode !== undefined) hasPhonePayload = true
  if (payload.phoneNumber !== undefined) hasPhonePayload = true

  if (!hasPhonePayload) return payload

  let phoneCountryCode = undefined
  if (payload.phoneCountryCode !== undefined) {
    phoneCountryCode = payload.phoneCountryCode
  }

  let phoneNumber = undefined
  if (payload.phoneNumber !== undefined) {
    phoneNumber = payload.phoneNumber
  }

  const normalized = normalizePhoneParts({
    phone: payload.phone,
    phoneCountryCode,
    phoneNumber
  })

  if (!normalized.phone_number) {
    payload.phone = null
    payload.phone_country_code = null
    payload.phone_number = null
  } else {
    payload.phone = normalized.phone
    payload.phone_country_code = normalized.phone_country_code
    payload.phone_number = normalized.phone_number
  }

  delete payload.phoneCountryCode
  delete payload.phoneNumber
  return payload
}

router.get('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  // Require accountId to avoid leaking tenants when using service role
  if (!accountId) return res.status(400).json({ error: 'accountId is required' })

  const { data, error } = await supabase
    .from('customers')
    .select('id,name,phone,phone_country_code,phone_number,email,address,nif,photo_url,account_id,pets(id,name,breed,photo_url,weight)')
    .eq('account_id', accountId)
    .order('name', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[api] customers error', error)
    return res.status(500).json({ error: error.message })
  }

  const enriched =
    data?.map((customer) => ({
      ...customer,
      pet_count: Array.isArray(customer.pets) ? customer.pets.length : 0
    })) || []

  res.json({ data: (enriched || []).map(mapCustomerForApi) })
})

router.post('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const payload = applyPhonePayload(sanitizeBody(req.body || {}))
  if (accountId) {
    payload.account_id = accountId
  }

  const { data, error } = await supabase.from('customers').insert([payload]).select()

  if (error) {
    console.error('[api] create customer error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data: (data || []).map(mapCustomerForApi) })
})

router.get('/:id/pets', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  if (!accountId) return res.status(400).json({ error: 'accountId is required' })

  const { id } = req.params
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .eq('account_id', accountId)
    .eq('customer_id', id)
    .order('name', { ascending: true })

  if (error) {
    console.error('[api] list pets error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: data || [] })
})

router.post('/:id/pets', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  if (!accountId) return res.status(400).json({ error: 'accountId is required' })

  const { id } = req.params
  const payload = applyPhonePayload(sanitizeBody(req.body || {}))
  payload.customer_id = id
  payload.account_id = accountId

  const { data, error } = await supabase.from('pets').insert([payload]).select()

  if (error) {
    console.error('[api] create pet error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ data })
})

router.patch('/:customerId/pets/:petId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { customerId, petId } = req.params
  const payload = sanitizeBody(req.body || {})

  let query = supabase.from('pets').update(payload).eq('id', petId).eq('customer_id', customerId)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.select()

  if (error) {
    console.error('[api] update pet error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: (data || []).map(mapCustomerForApi) })
})

router.delete('/:customerId/pets/:petId', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { customerId, petId } = req.params

  let query = supabase.from('pets').delete().eq('id', petId).eq('customer_id', customerId)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { error } = await query

  if (error) {
    console.error('[api] delete pet error', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(204).send()
})

router.patch('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params
  const payload = applyPhonePayload(sanitizeBody(req.body || {}))

  let query = supabase.from('customers').update(payload).eq('id', id)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { data, error } = await query.select()

  if (error) {
    console.error('[api] update customer error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ data: (data || []).map(mapCustomerForApi) })
})

router.delete('/:id', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })
  const { id } = req.params

  let query = supabase.from('customers').delete().eq('id', id)
  if (accountId) {
    query = query.eq('account_id', accountId)
  }

  const { error } = await query

  if (error) {
    console.error('[api] delete customer error', error)
    return res.status(500).json({ error: error.message })
  }

  res.json({ ok: true })
})

// Upload customer photo
router.post('/:id/photo', upload.single('file'), async (req, res) => {
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

  // Verificar se customer pertence à conta
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', req.params.id)
    .eq('account_id', accountId)
    .maybeSingle()

  if (!customer) return res.status(404).json({ error: 'Customer not found' })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg'
  const timestamp = Date.now()
  const filename = file.originalname || `customer-${req.params.id}-${timestamp}.${safeExt}`
  const path = `customers/${req.params.id}/${filename}`

  const { error: uploadError } = await supabase.storage
    .from('customers')
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) return res.status(500).json({ error: uploadError.message })

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from('customers')
    .createSignedUrl(path, 604800) // 7 dias

  if (signedError) return res.status(500).json({ error: signedError.message })

  const url = signedUrlData?.signedUrl || null

  // Guardar URL na BD
  if (url) {
    await supabase
      .from('customers')
      .update({ photo_url: url })
      .eq('id', req.params.id)
      .eq('account_id', accountId)
  }

  return res.json({ url })
})

// Upload pet photo
router.post('/:petId/pet-photo', upload.single('file'), async (req, res) => {
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

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  const path = `pets/${req.params.petId}-${uniqueId}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.mimetype || 'image/jpeg'
    })
  if (uploadError) return res.status(500).json({ error: uploadError.message })

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabase.storage
    .from(PET_PHOTO_BUCKET)
    .createSignedUrl(path, 604800)

  if (signedError) return res.status(500).json({ error: signedError.message })
  const url = signedUrlData?.signedUrl || null
  if (url) {
    await supabase
      .from('pets')
      .update({ photo_url: url })
      .eq('id', req.params.petId)
      .eq('account_id', accountId)
  }

  return res.json({ url })
})

export default router
