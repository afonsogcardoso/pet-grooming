import { Router } from 'express'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()

router.get('/', async (req, res) => {
  const accountId = req.accountId
  const supabase = accountId ? getSupabaseServiceRoleClient() : getSupabaseClientWithAuth(req)
  if (!supabase) return res.status(401).json({ error: 'Unauthorized' })

  let query = supabase
    .from('services')
    .select('id,name,default_duration,price,active,description,display_order')
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

  const { data, error } = await supabase.from('services').insert([mapped]).select()

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

  const { data, error } = await query.select()

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

export default router
