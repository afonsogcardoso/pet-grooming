import { Router } from 'express'
import crypto from 'crypto'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { parseAvailableRoles, mergeAvailableRoles } from '../utils/user.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()
const INVITE_SECRET =
  process.env.ACCOUNT_MEMBER_INVITE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing-secret'
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_BASE =
  process.env.APP_BASE_URL || process.env.MOBILE_APP_BASE_URL || process.env.PUBLIC_APP_BASE_URL || ''

function base64Url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function signInviteToken(payload) {
  const encoded = base64Url(JSON.stringify(payload))
  const signature = base64Url(crypto.createHmac('sha256', INVITE_SECRET).update(encoded).digest())
  return `${encoded}.${signature}`
}

function verifyInviteToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new Error('Invalid token')
  }
  const [encoded, signature] = token.split('.')
  const expected = base64Url(crypto.createHmac('sha256', INVITE_SECRET).update(encoded).digest())
  if (expected !== signature) throw new Error('Invalid signature')

  const payload = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))
  if (payload.exp && Date.now() > payload.exp) {
    throw new Error('Token expired')
  }
  return payload
}

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

function mapMemberRow(member) {
  if (!member) return null
  return {
    id: member.id,
    account_id: member.account_id,
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    created_at: member.created_at ?? null,
    email: member.email ?? null,
    displayName: member.display_name ?? member.displayName ?? null,
    firstName: member.first_name ?? member.firstName ?? null,
    lastName: member.last_name ?? member.lastName ?? null,
    avatarUrl: member.avatar_url ?? member.avatarUrl ?? null
  }
}

async function lookupUserByEmail(email) {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin || !email) return null
  const normalized = email.trim().toLowerCase()

  // Prefer the RPC that targets auth.users with an exact email match.
  const { data, error } = await supabaseAdmin.rpc('get_user_id_by_email', { p_email: normalized })
  if (error) {
    console.error('[invite] get_user_id_by_email error', error)
    return null
  }
  if (!data) return null
  return { id: data, email: normalized }
}

function logInvite(event, payload = {}) {
  try {
    const safe = { ...payload }
    delete safe.token
    delete safe.inviteToken
    console.info('[invite]', event, safe)
  } catch {
    // ignore logging errors
  }
}

router.get('/members', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  try {
    const { data, error } = await supabaseAdmin
      .from('account_member_profiles')
      .select(
        'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[api] account_members view error', {
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return res.status(500).json({
        error: error.message,
        details: error.details,
        hint: error.hint
      })
    }

    const members = (data || []).map(mapMemberRow)

    res.json({ members })
  } catch (err) {
    console.error('[api] account_members unexpected error', err)
    res.status(500).json({ error: err.message || 'Failed to load members' })
  }
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

  // Seed basic profile so the UI has a display name/avatar immediately
  const fallbackDisplayName = newUser.email || null
  await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: newUser.id,
        display_name: fallbackDisplayName,
        first_name: null,
        last_name: null,
        avatar_url: null
      },
      { onConflict: 'id' }
    )

  const { data, error } = await supabaseAdmin
    .from('account_members')
    .insert({ account_id: accountId, user_id: newUser.id, role, status: 'accepted' })
    .select('id, account_id, user_id, role, status, created_at')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  res.status(201).json({ member: { ...data, email: newUser.email } })
})

router.post('/members/invite', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { email, role = 'member' } = sanitizeBody(req.body || {})
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' })

  const appBase = APP_BASE
  try {
    let userId = null
    let targetEmail = normalizedEmail

    const existingUser = await lookupUserByEmail(normalizedEmail)

    if (existingUser?.id) {
      userId = existingUser.id
      targetEmail = existingUser.email || normalizedEmail
    } else {
      const {
        data: { user: newUser },
        error: createError
      } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: false,
        password: crypto.randomUUID(),
        user_metadata: { account_id: accountId, invite_pending: true }
      })

      if (createError) return res.status(400).json({ error: createError.message })
      userId = newUser.id
      targetEmail = newUser.email || normalizedEmail

      await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: newUser.id,
            display_name: targetEmail || null,
            first_name: null,
            last_name: null,
            avatar_url: null
          },
          { onConflict: 'id' }
        )
    }

    // Ensure invited user has 'provider' in available_roles
    try {
      const { data: adminUserData, error: adminUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (!adminUserError && adminUserData?.user) {
        const existingMeta = adminUserData.user.user_metadata || {}
        const currentRoles = parseAvailableRoles(existingMeta.available_roles)
        const merged = mergeAvailableRoles(currentRoles, 'provider')
        if (JSON.stringify(merged) !== JSON.stringify(currentRoles)) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            user_metadata: {
              ...(existingMeta || {}),
              available_roles: merged
            }
          })
        }
      }
    } catch (err) {
      console.error('[invite] ensure available_roles error', err)
    }

    const { data: existingMember } = await supabaseAdmin
      .from('account_members')
      .select('id, account_id, user_id, role, status, created_at')
      .eq('account_id', accountId)
      .eq('user_id', userId)
      .maybeSingle()

    if (existingMember && existingMember.status === 'accepted') {
      const { data: enrichedExisting } = await supabaseAdmin
        .from('account_member_profiles')
        .select(
          'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
        )
        .eq('id', existingMember.id)
        .maybeSingle()

      logInvite('existing-member', {
        accountId,
        userId: existingMember.user_id,
        memberId: existingMember.id,
        status: existingMember.status
      })

      return res.status(409).json({
        error: 'User is already a member of this account.',
        member: mapMemberRow(enrichedExisting || existingMember)
      })
    }

    let memberRow = existingMember
    if (!memberRow) {
      const { data, error } = await supabaseAdmin
        .from('account_members')
        .insert({ account_id: accountId, user_id: userId, role, status: 'pending' })
        .select('id, account_id, user_id, role, status, created_at')
        .single()

      if (error) return res.status(500).json({ error: error.message })
      memberRow = data
    }

    // Refresh from the view to include profile fields
    const { data: enriched } = await supabaseAdmin
      .from('account_member_profiles')
      .select(
        'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
      )
      .eq('id', memberRow.id)
      .maybeSingle()

    const payload = {
      memberId: memberRow.id,
      accountId,
      email: targetEmail,
      role: memberRow.role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7 // 7 days
    }

    const token = signInviteToken(payload)
    const inviteLink = appBase ? `${appBase.replace(/\/$/, '')}/invite?token=${token}` : null

    const responseBody = {
      member: mapMemberRow(enriched || memberRow),
      inviteLink: token && inviteLink ? inviteLink : null,
      inviteToken: token
    }

    logInvite('invite-created', {
      accountId,
      memberId: memberRow.id,
      userId,
      hasLink: Boolean(responseBody.inviteLink),
      appBase: APP_BASE ? 'set' : 'missing'
    })

    return res.status(201).json(responseBody)
  } catch (err) {
    console.error('[api] account_members invite error', err)
    return res.status(500).json({ error: err.message || 'Failed to send invite' })
  }
})

router.post('/members/invite/resend', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { memberId } = sanitizeBody(req.body || {})
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })

  const appBase = APP_BASE

  const { data: enriched, error } = await supabaseAdmin
    .from('account_member_profiles')
    .select(
      'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
    )
    .eq('account_id', accountId)
    .eq('id', memberId)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!enriched) return res.status(404).json({ error: 'Member not found' })
  if (enriched.status === 'accepted') {
    return res.status(400).json({ error: 'Member already accepted.' })
  }

  const payload = {
    memberId: enriched.id,
    accountId,
    email: enriched.email,
    role: enriched.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  }
  const token = signInviteToken(payload)
  const inviteLink = appBase ? `${appBase.replace(/\/$/, '')}/invite?token=${token}` : null

  const responseBody = {
    member: mapMemberRow(enriched),
    inviteLink: token && inviteLink ? inviteLink : null,
    inviteToken: token
  }

  logInvite('invite-resent', {
    accountId,
    memberId: enriched.id,
    userId: enriched.user_id,
    hasLink: Boolean(responseBody.inviteLink),
    appBase: APP_BASE ? 'set' : 'missing'
  })

  return res.json(responseBody)
})

router.post('/members/invite/cancel', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { memberId } = sanitizeBody(req.body || {})
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })

  const { data, error } = await supabaseAdmin
    .from('account_members')
    .update({ status: 'cancelled' })
    .eq('account_id', accountId)
    .eq('id', memberId)
    .select('id, account_id, user_id, role, status, created_at')
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Member not found' })

  const { data: enriched } = await supabaseAdmin
    .from('account_member_profiles')
    .select(
      'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
    )
    .eq('id', data.id)
    .maybeSingle()

  return res.json({ member: mapMemberRow(enriched || data) })
})

router.patch('/members/:memberId/role', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const memberId = req.params.memberId
  const { role } = sanitizeBody(req.body || {})
  const allowedRoles = ['admin', 'member']

  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, user_id, role, status, created_at')
    .eq('account_id', accountId)
    .eq('id', memberId)
    .maybeSingle()

  if (memberError) return res.status(500).json({ error: memberError.message })
  if (!memberRow) return res.status(404).json({ error: 'Member not found' })
  if (memberRow.role === 'owner') return res.status(400).json({ error: 'Owner role cannot be changed.' })

  const { data: updatedMember, error: updateError } = await supabaseAdmin
    .from('account_members')
    .update({ role })
    .eq('account_id', accountId)
    .eq('id', memberId)
    .select('id, account_id, user_id, role, status, created_at')
    .maybeSingle()

  if (updateError) return res.status(500).json({ error: updateError.message })

  const { data: enriched } = await supabaseAdmin
    .from('account_member_profiles')
    .select(
      'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
    )
    .eq('id', updatedMember.id)
    .maybeSingle()

  return res.json({ member: mapMemberRow(enriched || updatedMember) })
})

router.delete('/members/:memberId', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const memberId = req.params.memberId
  if (!memberId) return res.status(400).json({ error: 'Missing memberId' })

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, user_id, role, status, created_at')
    .eq('account_id', accountId)
    .eq('id', memberId)
    .maybeSingle()

  if (memberError) return res.status(500).json({ error: memberError.message })
  if (!memberRow) return res.status(404).json({ error: 'Member not found' })
  if (memberRow.role === 'owner') return res.status(400).json({ error: 'Account owner cannot be removed.' })

  const { error: deleteError } = await supabaseAdmin
    .from('account_members')
    .delete()
    .eq('account_id', accountId)
    .eq('id', memberId)

  if (deleteError) return res.status(500).json({ error: deleteError.message })
  return res.json({ ok: true })
})

router.post('/members/accept', async (req, res) => {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { token, password } = sanitizeBody(req.body || {})
  if (!token) return res.status(400).json({ error: 'Missing token' })

  let payload
  try {
    payload = verifyInviteToken(token)
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Invalid token' })
  }

  const { memberId, accountId, email } = payload || {}
  if (!memberId || !accountId || !email) {
    return res.status(400).json({ error: 'Invalid token payload' })
  }

  const { data: memberRow, error: memberError } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, user_id, role, status, created_at')
    .eq('id', memberId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (memberError) return res.status(500).json({ error: memberError.message })
  if (!memberRow) return res.status(404).json({ error: 'Member not found' })
  if (memberRow.status === 'cancelled') return res.status(400).json({ error: 'Invite cancelled' })
  if (memberRow.status === 'accepted') return res.status(200).json({ ok: true, member: mapMemberRow(memberRow) })

  // Ensure user still exists and update password/confirmation if provided
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(memberRow.user_id)
  if (userError) return res.status(500).json({ error: userError.message })
  if (!userData?.user) return res.status(404).json({ error: 'User not found' })

  const updates = { email_confirm: true }
  if (password) updates.password = password

  if (password || !userData.user.email_confirmed_at) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(memberRow.user_id, updates)
    if (updateError) return res.status(500).json({ error: updateError.message })
  }

  const { data: updatedMember, error: updateMemberError } = await supabaseAdmin
    .from('account_members')
    .update({ status: 'accepted' })
    .eq('id', memberId)
    .eq('account_id', accountId)
    .select('id, account_id, user_id, role, status, created_at')
    .maybeSingle()

  if (updateMemberError) return res.status(500).json({ error: updateMemberError.message })

  const { data: enriched } = await supabaseAdmin
    .from('account_member_profiles')
    .select(
      'id, account_id, user_id, role, status, created_at, display_name, first_name, last_name, avatar_url, email'
    )
    .eq('id', updatedMember.id)
    .maybeSingle()

  return res.json({ member: mapMemberRow(enriched || updatedMember) })
})

export default router
