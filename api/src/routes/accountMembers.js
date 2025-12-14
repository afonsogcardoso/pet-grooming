import { Router } from 'express'
import crypto from 'crypto'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()

function getBearer(req) {
  const auth = req.headers.authorization || ''
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }
  return null
}

async function resolveAccountId(req, supabaseAdmin) {
  if (req.accountId) return req.accountId
  if (!supabaseAdmin) return req.query.accountId || null

  const token = getBearer(req)
  if (!token) return req.query.accountId || null

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const userId = userData?.user?.id
  if (!userId) return req.query.accountId || null

  const { data: membership } = await supabaseAdmin
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membership?.account_id) return membership.account_id
  return req.query.accountId || null
}

async function requireOwnerOrAdmin(req, res) {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Service unavailable' })
    return { supabaseAdmin: null, userId: null, accountId: null }
  }

  const token = getBearer(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return { supabaseAdmin: null, userId: null, accountId: null }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' })
    return { supabaseAdmin: null, userId: null, accountId: null }
  }

  const accountId = await resolveAccountId(req, supabaseAdmin)
  if (!accountId) {
    res.status(400).json({ error: 'Missing accountId' })
    return { supabaseAdmin: null, userId: null, accountId: null }
  }

  const userId = userData.user.id
  const { data: membership } = await supabaseAdmin
    .from('account_members')
    .select('role, status')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()

  const isAllowed = membership && ['owner', 'admin'].includes(membership.role)
  if (!isAllowed) {
    res.status(403).json({ error: 'Forbidden' })
    return { supabaseAdmin: null, userId: null, accountId: null }
  }

  return { supabaseAdmin, userId, accountId }
}

router.get('/members', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { data, error } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, user_id, role, status, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const members = await Promise.all(
    (data || []).map(async (member) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id)
      return { ...member, email: userData?.user?.email || null }
    })
  )

  res.json({ members })
})

router.post('/members', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { email, password, role = 'member' } = sanitizeBody(req.body || {})
  if (!email) return res.status(400).json({ error: 'Email is required' })

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

export default router
