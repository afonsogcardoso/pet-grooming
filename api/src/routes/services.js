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

  const { data, error } = await supabase.from('services').insert([mapped]).select()

  if (error) {
    console.error('[api] create service error', error)
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
