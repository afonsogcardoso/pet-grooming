import { Router } from 'express'
import multer from 'multer'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { getAuthenticatedUser } from '../utils/auth.js'
import { normalizePhoneParts } from '../utils/phone.js'
import {
  collectAuthProviders,
  isPlatformAdmin,
  mergeAvailableRoles,
  normalizeUserRole,
  parseAvailableRoles,
  resolveActiveRole
} from '../utils/user.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const ALLOWED_LOCALES = ['pt', 'en']
const AVATAR_BUCKET = 'profiles'

router.get('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  let enrichedUser = user
  const { data: adminUserData } = await supabaseAdmin.auth.admin.getUserById(user.id)
  if (adminUserData?.user) {
    enrichedUser = adminUserData.user
  }

  const { data: memberships, error } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, role, status, created_at, accounts ( id, name, slug, logo_url, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const payload = {
    id: enrichedUser.id,
    email: enrichedUser.email,
    authProviders: collectAuthProviders(enrichedUser),
    created_at: enrichedUser.created_at,
    last_sign_in_at: enrichedUser.last_sign_in_at,
    platformAdmin: isPlatformAdmin(enrichedUser),
    memberships: (memberships || []).map((m) => ({
      ...m,
      account: m.accounts || null
    }))
  }

  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('display_name, first_name, last_name, avatar_url, phone, phone_country_code, preferred_locale, address, address_2')
    .eq('id', enrichedUser.id)
    .maybeSingle()

  const meta = enrichedUser.user_metadata || {}
  payload.displayName =
    profileRow?.display_name ||
    meta.display_name ||
    meta.full_name ||
    [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
    enrichedUser.email ||
    null
  payload.firstName = profileRow?.first_name ?? meta.first_name ?? null
  payload.lastName = profileRow?.last_name ?? meta.last_name ?? null
  payload.avatarUrl = profileRow?.avatar_url ?? meta.avatar_url ?? null
  payload.phone = profileRow?.phone ?? meta.phone ?? meta.phone_number ?? null
  payload.phoneNumber = meta.phone_number ?? profileRow?.phone ?? null
  payload.phoneCountryCode = profileRow?.phone_country_code ?? meta.phone_country_code ?? null
  payload.address = profileRow?.address ?? meta.address ?? null
  payload.address2 = profileRow?.address_2 ?? meta.address_2 ?? null
  payload.locale = profileRow?.preferred_locale ?? meta.preferred_locale ?? null

  const membershipCount = (memberships || []).filter((m) => m?.status === 'accepted').length

  let availableRoles = mergeAvailableRoles(
    parseAvailableRoles(enrichedUser.user_metadata?.available_roles),
    normalizeUserRole(enrichedUser.user_metadata?.active_role)
  )
  if (membershipCount === 0) {
    availableRoles = ['consumer']
  }
  payload.availableRoles = availableRoles
  payload.activeRole = resolveActiveRole({
    availableRoles,
    activeRole: enrichedUser.user_metadata?.active_role
  })

  res.json(payload)
})

router.patch('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const {
    displayName,
    firstName,
    lastName,
    phone,
    phoneCountryCode,
    phoneNumber,
    address,
    address2,
    locale,
    avatarUrl,
    activeRole
  } = req.body || {}
  const metadataUpdates = {}
  const trimmedFirstName = firstName?.toString().trim()
  const trimmedLastName = lastName?.toString().trim()
  if (trimmedFirstName !== undefined) metadataUpdates.first_name = trimmedFirstName || null
  if (trimmedLastName !== undefined) metadataUpdates.last_name = trimmedLastName || null
  if (displayName !== undefined) metadataUpdates.display_name = displayName?.trim() || null
  if ((trimmedFirstName || trimmedLastName) && displayName === undefined) {
    metadataUpdates.display_name = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ') || null
  }
  if (address !== undefined) {
    const trimmedAddress = address?.toString().trim()
    metadataUpdates.address = trimmedAddress || null
  }
  if (address2 !== undefined) {
    const trimmedAddress2 = address2?.toString().trim()
    metadataUpdates.address_2 = trimmedAddress2 || null
  }
  let hasPhonePayload = false
  if (phone !== undefined) hasPhonePayload = true
  if (phoneCountryCode !== undefined) hasPhonePayload = true
  if (phoneNumber !== undefined) hasPhonePayload = true

  if (hasPhonePayload) {
    let resolvedCountryCode = undefined
    if (phoneCountryCode !== undefined) {
      resolvedCountryCode = phoneCountryCode
    }

    let resolvedPhoneNumber = undefined
    if (phoneNumber !== undefined) {
      resolvedPhoneNumber = phoneNumber
    }

    const normalized = normalizePhoneParts({
      phone,
      phoneCountryCode: resolvedCountryCode,
      phoneNumber: resolvedPhoneNumber
    })
    if (!normalized.phone_number) {
      metadataUpdates.phone = null
      metadataUpdates.phone_country_code = null
      metadataUpdates.phone_number = null
    } else {
      metadataUpdates.phone = normalized.phone
      metadataUpdates.phone_country_code = normalized.phone_country_code
      metadataUpdates.phone_number = normalized.phone_number
    }
  }
  if (locale !== undefined) {
    const normalized = ALLOWED_LOCALES.includes(locale) ? locale : null
    metadataUpdates.preferred_locale = normalized || null
  }
  if (avatarUrl !== undefined) metadataUpdates.avatar_url = avatarUrl || null
  let normalizedActiveRole = null
  if (activeRole !== undefined) {
    normalizedActiveRole = normalizeUserRole(activeRole)
    if (!normalizedActiveRole) {
      return res.status(400).json({ error: 'Invalid role' })
    }
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  let enrichedUser = user
  const { data: adminUserData } = await supabaseAdmin.auth.admin.getUserById(user.id)
  if (adminUserData?.user) {
    enrichedUser = adminUserData.user
  }

  if (normalizedActiveRole) {
    const existingMetadata = enrichedUser.user_metadata || {}
    let availableRoles = mergeAvailableRoles(
      parseAvailableRoles(existingMetadata.available_roles),
      normalizeUserRole(existingMetadata.active_role)
    )
    if (normalizedActiveRole === 'provider' && !availableRoles.includes('provider')) {
      const { data: membership } = await supabaseAdmin
        .from('account_members')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle()
      if (!membership) {
        return res.status(400).json({ error: 'Provider role unavailable' })
      }
      availableRoles = mergeAvailableRoles(availableRoles, 'provider')
    }
    if (normalizedActiveRole === 'consumer') {
      availableRoles = mergeAvailableRoles(availableRoles, 'consumer')
    }
    metadataUpdates.active_role = normalizedActiveRole
    metadataUpdates.available_roles = availableRoles
  }

  if (!Object.keys(metadataUpdates).length) {
    return res.status(400).json({ error: 'No updates provided' })
  }

  const mergedMetadata = {
    ...(enrichedUser.user_metadata || {}),
    ...metadataUpdates
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: mergedMetadata
  })

  if (error) return res.status(500).json({ error: error.message })
  const updatedUser = data.user

  // Upsert into profiles to keep table in sync for reads
  await supabaseAdmin.from('profiles').upsert(
    {
      id: updatedUser.id,
      display_name: updatedUser?.user_metadata?.display_name ?? null,
      first_name: updatedUser?.user_metadata?.first_name ?? null,
      last_name: updatedUser?.user_metadata?.last_name ?? null,
      avatar_url: updatedUser?.user_metadata?.avatar_url ?? null,
      phone: updatedUser?.user_metadata?.phone ?? updatedUser?.user_metadata?.phone_number ?? null,
      phone_country_code: updatedUser?.user_metadata?.phone_country_code ?? null,
      preferred_locale: updatedUser?.user_metadata?.preferred_locale ?? null,
      address: updatedUser?.user_metadata?.address ?? null,
      address_2: updatedUser?.user_metadata?.address_2 ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  )

  const shouldSyncCustomerAddress =
    Object.prototype.hasOwnProperty.call(metadataUpdates, 'address') ||
    Object.prototype.hasOwnProperty.call(metadataUpdates, 'address_2')
  if (shouldSyncCustomerAddress) {
    const address = updatedUser?.user_metadata?.address ?? null
    const address2 = updatedUser?.user_metadata?.address_2 ?? null
    const { error: syncError } = await supabaseAdmin
      .from('customers')
      .update({ address, address_2: address2 })
      .eq('user_id', user.id)
    if (syncError) {
      console.error('[api] sync customer address error', syncError)
    }
  }
  const updatedFirstName = updatedUser?.user_metadata?.first_name ?? null
  const updatedLastName = updatedUser?.user_metadata?.last_name ?? null
  const updatedDisplayName =
    updatedUser?.user_metadata?.display_name ||
    [updatedFirstName, updatedLastName].filter(Boolean).join(' ') ||
    updatedUser?.email ||
    null
  const responsePhone = normalizePhoneParts({
    phone: updatedUser?.user_metadata?.phone,
    phoneCountryCode: updatedUser?.user_metadata?.phone_country_code,
    phoneNumber: updatedUser?.user_metadata?.phone_number
  })
  const responsePhoneCountryCode =
    responsePhone.phone_country_code === undefined ? null : responsePhone.phone_country_code
  const responsePhoneNumber =
    responsePhone.phone_number === undefined ? null : responsePhone.phone_number
  const availableRoles = mergeAvailableRoles(
    parseAvailableRoles(updatedUser?.user_metadata?.available_roles),
    normalizeUserRole(updatedUser?.user_metadata?.active_role)
  )
  const resolvedActiveRole = resolveActiveRole({
    availableRoles,
    activeRole: updatedUser?.user_metadata?.active_role
  })

  return res.json({
    user: {
      id: updatedUser?.id,
      email: updatedUser?.email,
    displayName: updatedDisplayName,
    firstName: updatedFirstName,
    lastName: updatedLastName,
    address: updatedUser?.user_metadata?.address ?? null,
    address2: updatedUser?.user_metadata?.address_2 ?? null,
    phone: responsePhone.phone === undefined ? null : responsePhone.phone,
    phoneCountryCode: responsePhoneCountryCode,
    phoneNumber: responsePhoneNumber,
      locale: updatedUser?.user_metadata?.preferred_locale === undefined ? null : updatedUser?.user_metadata?.preferred_locale,
      avatarUrl: updatedUser?.user_metadata?.avatar_url === undefined ? null : updatedUser?.user_metadata?.avatar_url,
      activeRole: resolvedActiveRole,
      availableRoles,
      lastLoginAt: updatedUser?.last_sign_in_at === undefined ? null : updatedUser?.last_sign_in_at,
      createdAt: updatedUser?.created_at === undefined ? null : updatedUser?.created_at,
      platformAdmin: isPlatformAdmin(updatedUser)
    }
  })
})

router.post('/avatar', upload.single('file'), async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const path = `avatars/${user.id}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
    .from('profiles')
    .createSignedUrl(path, 604800) // 7 dias

  if (signedError) return res.status(500).json({ error: signedError.message })

  // Atualizar user metadata com a URL
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { avatar_url: signedUrlData?.signedUrl }
  })

  return res.json({ url: signedUrlData?.signedUrl || null })
})

router.post('/reset-password', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { newPassword } = req.body || {}
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password inválida (min 8 chars)' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
})

export default router
