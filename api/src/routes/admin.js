import express from 'express'
import crypto from 'crypto'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { isPlatformAdmin } from '../utils/user.js'
import { sanitizeSlug } from '../utils/slug.js'

const router = express.Router()

const MAX_PAGE_SIZE = 100
const FACET_LIMIT = 200

async function requireAdmin(req, res) {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  if (!isPlatformAdmin(data.user)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return data.user
}

function normalizeFilter(value) {
  const v = value?.trim().toLowerCase()
  if (!v) return null
  return v
}

function normalizeSearch(value) {
  const v = value?.trim()
  return v || null
}

function escapeSearch(value) {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function clampPageSize(size) {
  return Math.min(Math.max(size || 10, 1), MAX_PAGE_SIZE)
}

function clampFacetLimit(size) {
  return Math.min(Math.max(size || 50, 1), FACET_LIMIT)
}

router.get('/accounts', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { searchParams } = new URL(req.url, 'http://localhost')
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const pageSize = clampPageSize(parseInt(searchParams.get('pageSize') || '10', 10) || 10)
  const plan = normalizeFilter(searchParams.get('plan'))
  const status = normalizeFilter(searchParams.get('status'))
  const search = normalizeSearch(searchParams.get('search'))

  let query = supabaseAdmin
    .from('accounts')
    .select(
      'id, name, slug, plan, is_active, created_at, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient, logo_url, portal_image_url',
      { count: 'exact' }
    )

  if (plan) query = query.eq('plan', plan)
  if (status) query = query.eq('is_active', status === 'active')
  if (search) {
    const escaped = escapeSearch(search)
    query = query.or(`name.ilike.%${escaped}%,slug.ilike.%${escaped}%`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, to)
  if (error) return res.status(500).json({ error: error.message })

  // facet plans
  const { data: planFacet } = await supabaseAdmin
    .from('accounts')
    .select('plan, count:count()', { group: 'plan' })
    .limit(clampFacetLimit(FACET_LIMIT))

  res.json({
    accounts: data || [],
    total: count ?? 0,
    page,
    pageSize,
    planOptions: (planFacet || []).map((item) => item.plan).filter(Boolean),
    statusOptions: ['active', 'inactive']
  })
})

router.get('/accounts/:id', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, name, slug, plan, is_active, created_at')
    .eq('id', accountId)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Account not found' })
  res.json({ account: data })
})

router.post('/accounts', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return

  const { name, slug, plan = 'standard' } = req.body || {}
  if (!name) return res.status(400).json({ error: 'Nome obrigatório.' })
  const normalizedSlug = sanitizeSlug(slug || name)
  if (!normalizedSlug) return res.status(400).json({ error: 'Slug inválido.' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const accountPayload = { name: name.trim(), slug: normalizedSlug, plan: plan?.trim() || 'standard', is_active: true }
  const { data: account, error } = await supabaseAdmin
    .from('accounts')
    .insert(accountPayload)
    .select('id, name, slug, plan, is_active, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Slug já está a ser usado.' })
    return res.status(500).json({ error: error.message })
  }

  res.status(201).json({ account })
})

router.patch('/accounts', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return

  const { accountId, updates } = req.body || {}
  if (!accountId || !updates) return res.status(400).json({ error: 'Missing accountId or updates' })

  const allowedFields = [
    'name',
    'plan',
    'is_active',
    'brand_primary',
    'brand_primary_soft',
    'brand_accent',
    'brand_accent_soft',
    'brand_background',
    'brand_gradient',
    'logo_url',
    'portal_image_url'
  ]
  const sanitizedUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
    if (!allowedFields.includes(key)) return acc
    acc[key] = typeof value === 'string' ? value.trim() : value
    return acc
  }, {})

  if (!Object.keys(sanitizedUpdates).length) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .update(sanitizedUpdates)
    .eq('id', accountId)
    .select('id, name, slug, plan, is_active, created_at')
    .single()
  if (error) return res.status(500).json({ error: error.message })
  res.json({ account: data })
})

router.put('/accounts', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return

  const { accountIds, action } = req.body || {}
  if (!Array.isArray(accountIds) || accountIds.length === 0) {
    return res.status(400).json({ error: 'Missing accountIds' })
  }
  if (action !== 'delete') {
    return res.status(400).json({ error: 'Unsupported action' })
  }
  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.from('accounts').delete().in('id', accountIds)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, deleted: accountIds.length })
})

router.get('/accounts/:id/members', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const [{ data: account }, { data, error }] = await Promise.all([
    supabaseAdmin
      .from('accounts')
      .select('id, name, plan, is_active, created_at')
      .eq('id', accountId)
      .maybeSingle(),
    supabaseAdmin
      .from('account_members')
      .select('id, account_id, user_id, role, status, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
  ])

  if (error) return res.status(500).json({ error: error.message })
  res.json({ account: account || null, members: data || [], timeline: [] })
})

router.post('/accounts/:id/members', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id
  const { email, password, role = 'member', action, memberId } = req.body || {}

  if (action === 'resend_invite') {
    return res.json({ ok: true, message: 'Invite re-sent (noop placeholder)' })
  }
  if (!email) return res.status(400).json({ error: 'Missing email' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const {
    data: { user: newUser },
    error: createError
  } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: password || crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { account_id: accountId }
  })

  if (createError) return res.status(400).json({ error: createError.message })

  const { data, error } = await supabaseAdmin
    .from('account_members')
    .insert({ account_id: accountId, user_id: newUser.id, role, status: 'accepted' })
    .select('id, account_id, user_id, role, status, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ member: { ...data, email: newUser.email } })
})

router.patch('/accounts/:id/members', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id
  const { memberId, role, profile } = req.body || {}
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })
  if (!role && !profile) return res.status(400).json({ error: 'Missing role/profile' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' })
  }
  let query = supabaseAdmin.from('account_members').eq('id', memberId).eq('account_id', accountId)

  if (role) {
    query = query.update({ role })
  } else {
    // No profile columns yet; return the existing member unchanged
    const { data: existing } = await query.select('id, account_id, user_id, role, status, created_at').maybeSingle()
    return res.json({ member: existing })
  }

  const { data, error } = await query.select('id, account_id, user_id, role, status, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ member: data })
})

router.delete('/accounts/:id/members', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id
  const { memberId, action } = req.body || {}
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (action === 'accept_invite') {
    const { data, error } = await supabaseAdmin
      .from('account_members')
      .update({ status: 'accepted' })
      .eq('id', memberId)
      .eq('account_id', accountId)
      .select('id, account_id, user_id, role, status, created_at')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ member: data })
  }

  const { error } = await supabaseAdmin.from('account_members').delete().eq('id', memberId).eq('account_id', accountId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

router.get('/apikeys', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const supabaseAdmin = getSupabaseServiceRoleClient()

  const { searchParams } = new URL(req.url, 'http://localhost')
  const accountId = searchParams.get('accountId')
  const status = normalizeFilter(searchParams.get('status'))
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const pageSize = clampPageSize(parseInt(searchParams.get('pageSize') || '20', 10))

  let query = supabaseAdmin
    .from('api_keys')
    .select('id, account_id, name, key_prefix, status, created_at, last_used_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (accountId) query = query.eq('account_id', accountId)
  if (status) query = query.eq('status', status)
  if (search) {
    const escaped = search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(`name.ilike.%${escaped}%,key_prefix.ilike.%${escaped}%`)
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)
  if (error) return res.status(500).json({ error: error.message })

  res.json({ keys: data || [], total: count ?? 0, page, pageSize })
})

router.post('/apikeys', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { accountId, name } = req.body || {}
  if (!accountId || !name) return res.status(400).json({ error: 'Missing accountId or name' })

  const { key, prefix, hash } = generateKey()
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      account_id: accountId,
      name: name.trim(),
      key_prefix: prefix,
      key_hash: hash,
      status: 'active',
      created_by: user.id
    })
    .select('id, account_id, name, key_prefix, status, created_at, last_used_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ key, record: data })
})

router.patch('/apikeys', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const supabaseAdmin = getSupabaseServiceRoleClient()

  const { id, status } = req.body || {}
  if (!id || !status) return res.status(400).json({ error: 'Missing id or status' })
  if (!['active', 'revoked'].includes(status)) return res.status(400).json({ error: 'Invalid status' })

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .update({ status })
    .eq('id', id)
    .select('id, account_id, name, key_prefix, status, created_at, last_used_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ key: data })
})

router.delete('/apikeys', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'Missing id' })
  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.from('api_keys').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

router.post('/users/reset-password', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const { userId, newPassword } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword || crypto.randomUUID()
  })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

router.get('/users', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const supabaseAdmin = getSupabaseServiceRoleClient()
  const { searchParams } = new URL(req.url, 'http://localhost')
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
  const perPage = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '20', 10), 1), 100)
  const search = normalizeSearch(searchParams.get('search'))

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage
    })
    if (error) return res.status(500).json({ error: error.message })
    let users = data?.users || []
    if (search) {
      const term = search.toLowerCase()
      users = users.filter((u) => u.email?.toLowerCase().includes(term))
    }
    res.json({
      users,
      page,
      pageSize: perPage,
      total: data?.total ?? users.length
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

router.post('/accounts/:id/maintenance', async (req, res) => {
  const user = await requireAdmin(req, res)
  if (!user) return
  const accountId = req.params.id
  const { action } = req.body || {}
  if (!action) return res.status(400).json({ error: 'Missing action' })
  const supabaseAdmin = getSupabaseServiceRoleClient()

  const tasks = []
  if (action === 'purge_appointments' || action === 'purge_all') {
    tasks.push(supabaseAdmin.from('appointments').delete().eq('account_id', accountId))
  }
  if (action === 'purge_services' || action === 'purge_all') {
    tasks.push(supabaseAdmin.from('services').delete().eq('account_id', accountId))
  }
  if (action === 'purge_customers' || action === 'purge_all') {
    tasks.push(supabaseAdmin.from('customers').delete().eq('account_id', accountId))
  }

  try {
    const results = await Promise.all(tasks)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      return res.status(500).json({ error: failed.error.message })
    }
    res.json({ ok: true, action })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

function generateKey() {
  const key = crypto.randomBytes(24).toString('hex')
  const prefix = key.slice(0, 8)
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  return { key, prefix, hash }
}

export default router
