import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { normalizePhoneParts } from '../utils/phone.js'
import { sanitizeSlug } from '../utils/slug.js'
import {
  collectAuthProviders,
  mergeAvailableRoles,
  normalizeUserRole,
  parseAvailableRoles,
  resolveActiveRole
} from '../utils/user.js'

const router = express.Router()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

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
    role,
    registerAs
  } = req.body || {}
  const normalizedRole = normalizeUserRole(role || registerAs) || 'provider'
  if (!email || !password || (normalizedRole === 'provider' && !accountName)) {
    const message =
      normalizedRole === 'provider'
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
  const availableRoles = [normalizedRole]
  const metadata = {
    display_name: `${trimmedFirstName} ${trimmedLastName}`,
    first_name: trimmedFirstName,
    last_name: trimmedLastName,
    phone: phoneParts.phone,
    phone_country_code: phoneParts.phone_country_code,
    phone_number: phoneParts.phone_number,
    available_roles: availableRoles,
    active_role: normalizedRole
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

  if (normalizedRole === 'consumer') {
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
      available_roles: mergeAvailableRoles(
        parseAvailableRoles(createdUser.user.user_metadata?.available_roles),
        normalizedRole
      ),
      active_role: normalizedRole
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

router.post('/auth/oauth-signup', async (req, res) => {
  const {
    accessToken,
    refreshToken,
    accountName,
    firstName,
    lastName,
    phone,
    phoneCountryCode,
    phoneNumber,
    role,
    registerAs
  } = req.body || {}
  const normalizedRole = normalizeUserRole(role || registerAs) || 'provider'

  if (!accessToken) {
    return res.status(400).json({ error: 'Access token obrigatório' })
  }

  if (normalizedRole === 'provider' && !accountName?.toString().trim()) {
    return res.status(400).json({ error: 'Nome da conta é obrigatório' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const user = userData.user
  const trimmedFirstName = firstName?.toString().trim() || null
  const trimmedLastName = lastName?.toString().trim() || null
  const userMetadata = user.user_metadata || {}
  const existingRoles = parseAvailableRoles(userMetadata.available_roles)
  const hasProviderAccount = Boolean(userMetadata.account_id)
  let mergedRoles = mergeAvailableRoles(existingRoles, normalizedRole, hasProviderAccount ? 'provider' : null)
  const resolvedFirstName =
    trimmedFirstName ||
    userMetadata.given_name ||
    userMetadata.first_name ||
    null
  const resolvedLastName =
    trimmedLastName ||
    userMetadata.family_name ||
    userMetadata.last_name ||
    null
  const resolvedDisplayName =
    userMetadata.full_name ||
    userMetadata.name ||
    userMetadata.display_name ||
    [resolvedFirstName, resolvedLastName].filter(Boolean).join(' ') ||
    user.email ||
    null

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

  const metadataUpdates = {
    ...(resolvedDisplayName ? { display_name: resolvedDisplayName } : {}),
    ...(resolvedFirstName ? { first_name: resolvedFirstName } : {}),
    ...(resolvedLastName ? { last_name: resolvedLastName } : {}),
    phone: phoneParts.phone,
    phone_country_code: phoneParts.phone_country_code,
    phone_number: phoneParts.phone_number,
    available_roles: mergedRoles,
    active_role: normalizedRole
  }

  let accountId = null
  let accountSlug = null

  if (normalizedRole === 'provider') {
    const { data: membership } = await supabaseAdmin
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .maybeSingle()

    if (membership?.account_id) {
      accountId = membership.account_id
      const { data: account } = await supabaseAdmin
        .from('accounts')
        .select('slug')
        .eq('id', accountId)
        .maybeSingle()
      accountSlug = account?.slug || null
    } else {
      const baseSlug = sanitizeSlug(accountName) || `account-${user.id.slice(0, 8)}`
      const slug = await ensureUniqueSlug(supabaseAdmin, baseSlug)

      const { data: account, error: accountError } = await supabaseAdmin
        .from('accounts')
        .insert({ name: accountName.trim(), slug, plan: 'standard' })
        .select('id, slug')
        .single()

      if (accountError || !account?.id) {
        return res.status(500).json({ error: accountError?.message || 'Erro ao criar conta' })
      }

      const { error: memberError } = await supabaseAdmin
        .from('account_members')
        .insert({
          account_id: account.id,
          user_id: user.id,
          role: 'owner',
          status: 'accepted'
        })

      if (memberError) {
        return res.status(500).json({ error: memberError.message || 'Erro ao criar membro' })
      }

      accountId = account.id
      accountSlug = account.slug
    }
  }

  if (accountId) {
    mergedRoles = mergeAvailableRoles(mergedRoles, 'provider')
    metadataUpdates.available_roles = mergedRoles
  }

  const mergedMetadata = {
    ...(user.user_metadata || {}),
    ...metadataUpdates,
    ...(accountId ? { account_id: accountId } : {})
  }

  const { data: updatedData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { user_metadata: mergedMetadata }
  )

  if (updateError) return res.status(500).json({ error: updateError.message })

  const updatedUser = updatedData?.user || user
  const displayName =
    updatedUser?.user_metadata?.display_name ||
    resolvedDisplayName ||
    updatedUser?.email ||
    null

  return res.json({
    token: accessToken,
    refreshToken,
    email: updatedUser?.email,
    displayName,
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    accountId,
    accountSlug,
    activeRole: normalizeUserRole(updatedUser?.user_metadata?.active_role) || normalizedRole,
    availableRoles: parseAvailableRoles(updatedUser?.user_metadata?.available_roles)
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
  const supabaseAdmin = getSupabaseServiceRoleClient()
  let enrichedUser = user
  if (supabaseAdmin) {
    const { data: adminUserData } = await supabaseAdmin.auth.admin.getUserById(user.id)
    if (adminUserData?.user) {
      enrichedUser = adminUserData.user
    }
  }

  const roles = enrichedUser?.app_metadata?.roles || []
  const platformAdmin =
    Boolean(enrichedUser?.user_metadata?.platform_admin) ||
    Boolean(enrichedUser?.app_metadata?.platform_admin) ||
    roles.includes('platform_admin')

  const membershipClient = supabaseAdmin || supabase
  const includeMemberships = ['1', 'true', 'yes'].includes(
    String(req.query.includeMemberships || '').toLowerCase()
  )
  let memberships = []
  let membershipCount = 0

  if (includeMemberships) {
    const { data: loadedMemberships, error: membershipError } = await membershipClient
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
    memberships = loadedMemberships || []
    membershipCount = memberships.length
  } else {
    const { count, error: countError } = await membershipClient
      .from('account_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'accepted')

    if (countError) {
      console.error('profile memberships count error', countError)
    }
    membershipCount = count || 0
  }

  const profilePhone = normalizePhoneParts({
    phone: enrichedUser.user_metadata?.phone,
    phoneCountryCode: enrichedUser.user_metadata?.phone_country_code,
    phoneNumber: enrichedUser.user_metadata?.phone_number
  })
  let availableRoles = mergeAvailableRoles(
    parseAvailableRoles(enrichedUser.user_metadata?.available_roles),
    normalizeUserRole(enrichedUser.user_metadata?.active_role)
  )
  if (!availableRoles.length) {
    availableRoles = ['provider']
  }
  if (membershipCount > 0) {
    availableRoles = mergeAvailableRoles(availableRoles, 'provider')
  }
  const activeRole = resolveActiveRole({
    availableRoles,
    activeRole: enrichedUser.user_metadata?.active_role
  })
  const responsePhone = profilePhone.phone === undefined ? null : profilePhone.phone
  const responsePhoneCountryCode =
    profilePhone.phone_country_code === undefined ? null : profilePhone.phone_country_code
  const responsePhoneNumber =
    profilePhone.phone_number === undefined ? null : profilePhone.phone_number
  return res.json({
    id: enrichedUser.id,
    email: enrichedUser.email,
    displayName:
      enrichedUser.user_metadata?.display_name ||
      [enrichedUser.user_metadata?.first_name, enrichedUser.user_metadata?.last_name].filter(Boolean).join(' ') ||
      enrichedUser.email ||
      null,
    firstName: enrichedUser.user_metadata?.first_name ?? null,
    lastName: enrichedUser.user_metadata?.last_name ?? null,
    phone: responsePhone,
    phoneCountryCode: responsePhoneCountryCode,
    phoneNumber: responsePhoneNumber,
    locale: enrichedUser.user_metadata?.preferred_locale ?? 'pt',
    avatarUrl: enrichedUser.user_metadata?.avatar_url ?? null,
    activeRole,
    availableRoles,
    lastLoginAt: enrichedUser.last_sign_in_at ?? null,
    createdAt: enrichedUser.created_at ?? null,
    authProviders: collectAuthProviders(enrichedUser),
    membershipCount,
    memberships: memberships || [],
    platformAdmin
  })
})

export default router
