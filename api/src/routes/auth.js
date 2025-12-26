import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { normalizePhoneParts } from '../utils/phone.js'

const router = express.Router()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

function sanitizeSlug(slug) {
  return slug
    ?.toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function ensureSupabaseConfig(res) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Auth not configured (SUPABASE_URL/ANON_KEY missing)' })
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

async function ensureUniqueSlug(supabaseAdmin, baseSlug) {
  let slug = baseSlug
  let attempt = 0
  while (attempt < 50) {
    const { data, error } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (error) {
      console.warn('[auth] slug lookup failed', error)
      return slug
    }
    if (!data) return slug
    attempt += 1
    slug = `${baseSlug}-${attempt + 1}`
  }
  return `${baseSlug}-${Date.now().toString(36)}`
}

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password obrigatórios' })
  }

  const supabase = ensureSupabaseConfig(res)
  if (!supabase) return

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    return res.status(401).json({ error: error?.message || 'Credenciais inválidas' })
  }

  const { session, user } = data
  const firstName = user?.user_metadata?.first_name?.toString().trim() || null
  const lastName = user?.user_metadata?.last_name?.toString().trim() || null
  const derivedName = [firstName, lastName].filter(Boolean).join(' ') || null
  const displayName = user?.user_metadata?.display_name || derivedName || user?.email || null

  return res.json({
    token: session.access_token,
    refreshToken: session.refresh_token,
    email: user?.email,
    displayName,
    firstName,
    lastName
  })
})

router.post('/auth/signup', async (req, res) => {
  const {
    email,
    password,
    accountName,
    firstName,
    lastName,
    phone,
    phoneCountryCode,
    phoneNumber,
    userType
  } = req.body || {}
  const normalizedUserType = userType === 'consumer' ? 'consumer' : 'provider'
  if (!email || !password || (normalizedUserType === 'provider' && !accountName)) {
    const message =
      normalizedUserType === 'provider'
        ? 'Email, password e nome da conta são obrigatórios'
        : 'Email e password são obrigatórios'
    return res.status(400).json({ error: message })
  }
  const trimmedFirstName = firstName?.toString().trim()
  const trimmedLastName = lastName?.toString().trim()
  if (!trimmedFirstName || !trimmedLastName) {
    return res.status(400).json({ error: 'Primeiro e último nome são obrigatórios' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password inválida (min 8 chars)' })
  }

  const supabase = ensureSupabaseConfig(res)
  if (!supabase) return

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  let resolvedCountryCode = undefined
  if (phoneCountryCode !== undefined) {
    resolvedCountryCode = phoneCountryCode
  }

  let resolvedPhoneNumber = undefined
  if (phoneNumber !== undefined) {
    resolvedPhoneNumber = phoneNumber
  }

  const phoneParts = normalizePhoneParts({
    phone,
    phoneCountryCode: resolvedCountryCode,
    phoneNumber: resolvedPhoneNumber
  })
  const metadata = {
    display_name: `${trimmedFirstName} ${trimmedLastName}`,
    first_name: trimmedFirstName,
    last_name: trimmedLastName,
    phone: phoneParts.phone,
    phone_country_code: phoneParts.phone_country_code,
    phone_number: phoneParts.phone_number,
    user_type: normalizedUserType
  }

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata
  })

  if (createUserError || !createdUser?.user?.id) {
    return res.status(400).json({ error: createUserError?.message || 'Erro ao criar utilizador' })
  }

  if (normalizedUserType === 'consumer') {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (signInError || !signInData?.session) {
      return res.status(201).json({
        email: createdUser.user.email,
        message: 'Conta criada, faça login'
      })
    }

    const { session, user } = signInData
    return res.json({
      token: session.access_token,
      refreshToken: session.refresh_token,
      email: user?.email,
      displayName: user?.user_metadata?.display_name ?? user?.email ?? null,
      firstName: trimmedFirstName,
      lastName: trimmedLastName
    })
  }

  const baseSlug = sanitizeSlug(accountName) || `account-${createdUser.user.id.slice(0, 8)}`
  const slug = await ensureUniqueSlug(supabaseAdmin, baseSlug)

  const { data: account, error: accountError } = await supabaseAdmin
    .from('accounts')
    .insert({ name: accountName.trim(), slug, plan: 'standard' })
    .select('id, name, slug, plan')
    .single()

  if (accountError || !account?.id) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id).catch(() => null)
    return res.status(500).json({ error: accountError?.message || 'Erro ao criar conta' })
  }

  const { error: memberError } = await supabaseAdmin
    .from('account_members')
    .insert({
      account_id: account.id,
      user_id: createdUser.user.id,
      role: 'owner',
      status: 'accepted'
    })

  if (memberError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id).catch(() => null)
    return res.status(500).json({ error: memberError.message || 'Erro ao criar membro' })
  }

  await supabaseAdmin.auth.admin.updateUserById(createdUser.user.id, {
    user_metadata: {
      ...(createdUser.user.user_metadata || {}),
      account_id: account.id,
      user_type: normalizedUserType
    }
  })

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (signInError || !signInData?.session) {
    return res.status(201).json({
      email: createdUser.user.email,
      accountId: account.id,
      accountSlug: account.slug,
      message: 'Conta criada, faça login'
    })
  }

  const { session, user } = signInData

  return res.json({
    token: session.access_token,
    refreshToken: session.refresh_token,
    email: user?.email,
    displayName: user?.user_metadata?.display_name ?? user?.email ?? null,
    firstName: trimmedFirstName,
    lastName: trimmedLastName,
    accountId: account.id,
    accountSlug: account.slug
  })
})

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token obrigatório' })
  }

  const supabase = ensureSupabaseConfig(res)
  if (!supabase) return

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data?.session) {
    return res.status(401).json({ error: error?.message || 'Refresh inválido' })
  }

  const { session, user } = data
  return res.json({
    token: session.access_token,
    refreshToken: session.refresh_token,
    email: user?.email,
    displayName: user?.user_metadata?.display_name ?? user?.email ?? null
  })
})

router.get('/profile', async (req, res) => {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return res.status(401).json({ error: error?.message || 'Unauthorized' })
  }

  const user = data.user
  const roles = user?.app_metadata?.roles || []
  const platformAdmin =
    Boolean(user?.user_metadata?.platform_admin) ||
    Boolean(user?.app_metadata?.platform_admin) ||
    roles.includes('platform_admin')

  const { data: memberships, error: membershipError } = await supabase
    .from('account_members')
    .select(
      `
      account_id,
      role,
      status,
      created_at,
      account:accounts (id, name, slug, plan)
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })

  if (membershipError) {
    console.error('profile memberships error', membershipError)
  }

  const profilePhone = normalizePhoneParts({
    phone: user.user_metadata?.phone,
    phoneCountryCode: user.user_metadata?.phone_country_code,
    phoneNumber: user.user_metadata?.phone_number
  })
  const responsePhone = profilePhone.phone === undefined ? null : profilePhone.phone
  const responsePhoneCountryCode =
    profilePhone.phone_country_code === undefined ? null : profilePhone.phone_country_code
  const responsePhoneNumber =
    profilePhone.phone_number === undefined ? null : profilePhone.phone_number
  return res.json({
    id: user.id,
    email: user.email,
    displayName:
      user.user_metadata?.display_name ||
      [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(' ') ||
      user.email ||
      null,
    firstName: user.user_metadata?.first_name ?? null,
    lastName: user.user_metadata?.last_name ?? null,
    phone: responsePhone,
    phoneCountryCode: responsePhoneCountryCode,
    phoneNumber: responsePhoneNumber,
    locale: user.user_metadata?.preferred_locale ?? 'pt',
    avatarUrl: user.user_metadata?.avatar_url ?? null,
    userType: user.user_metadata?.user_type ?? 'provider',
    lastLoginAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at ?? null,
    memberships: memberships || [],
    platformAdmin
  })
})

export default router
